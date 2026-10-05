# Prompt: dice-server

## Context

Bouw een MCP-server die dobbelstenen rolt. De server biedt oorspronkelijk precies één tool aan:
`roll_dice`. Een tweede tool, `flip_coin`, is inmiddels toegevoegd; zie `tasks02.md`.

Een MCP-server is een programma dat een model (zoals opencode) via het Model Context Protocol
tools aanbiedt die het model zelf kan aanroepen. Zodra de server bij opencode is geregistreerd,
wordt bij een prompt als *"gooi een 20-zijdige dobbelsteen"* automatisch `roll_dice` met
`"sides": 20` aangeroepen.

## Taalregels

- Documentatie- en tekstbestanden (`AGENTS.md`, `tasks.md`, `uitleg.md`, `README.md`, comments in
  configbestanden): **Nederlands**.
- Code: identifiers en commando's in het **Engels**.
- **Foutmeldingen worden gegeven in de taal van het gesprek waarin de gebruiker de dobbelsteen
  vroeg.** Voor een Engelse prompt is de foutmelding Engels; voor *"gooi een 4,3-zijdige
  dobbelsteen"* is hij Nederlands. Dit staat in de toolregels hieronder uitgewerkt.
- Voeg geen overbodige comments toe aan de broncode. Leg intentie uit in `uitleg.md`.

## Stack

- TypeScript
- npm
- `@modelcontextprotocol/sdk` — gebruik de API van de geïnstalleerde versie; controleer dit na
  installatie in `node_modules` voordat je code schrijft.
- Transport: stdio (`StdioServerTransport`).

## Projectstructuur

```
dice-server/
├── src/
│   ├── index.ts        # MCP-server: toolregistratie, foutafhandeling, stdio-connect
│   └── dice.ts         # kern: parametervalidatie + dobbelen, pure functie
├── dist/               # build-uitvoer (gegenereerd, niet handmatig bewerken)
├── package.json
├── tsconfig.json
├── .gitignore
├── opencode.json       # lokale MCP-registratie voor dit project
├── AGENTS.md
├── tasks.md
└── uitleg.md
```

## Toolcontract

Naam: `roll_dice`

Parameter:
- `sides` — **verplicht**, geheel getal, minimaal `2`. Beschrijf dit in de toolbeschrijving, zodat
  het model het juiste aantal kanten kiest.
- `lang` — **optioneel**, de taal waarin foutmeldingen moeten worden gegeven: de taal van het
  gesprek waarin de gebruiker vroeg om te dobbelen. Neem een gangbare taalcode zoals `en` of `nl`.
  De toolbeschrijving moet dit expliciet aan het model uitleggen, want het model — niet de server —
  ziet de oorspronkelijke prompt. Bij ontbreken of een niet-ondersteunde code valt de server terug
  op Engels.

Resultaat bij geldige invoer:
- Eén geheel getal in `1..sides`, **inclusief** beide grenzen. Dus `1 <= resultaat <= sides`.
- Response als MCP-`content` met één `text`-blok dat het getal bevat, zodat het model het direct kan
  gebruiken in zijn antwoord. De uitkomst zelf is een getal en dus taalneutraal.

Resultaat bij ongeldige invoer:
- Een foutmelding terug in de response met `isError: true` en een duidelijke `text`-foutmelding
  **in de taal uit `lang`**. De melding zegt wat er mis is, wat er ontvangen is en welke waarden
  wél geldig zijn.
- **Het proces mag niet crashen.** Geen exception die ongehandeld naar buiten ontsnapt, geen
  `process.exit()` in de foutafhandeling. Na een fout moet de volgende aanroep gewoon werken.
- Ongeldige invoer betreft minimaal: `sides` ontbreekt, `null`, een string, een boolean, `NaN`,
  `Infinity`, een fractie (`2.5`), `1`, `0`, negatieve getallen en waarden boven een veilige
  bovengrens (kies zelf een grens, bijvoorbeeld `10_000`, om te voorkomen dat iemand
  `sides: 1e9` aanvraagt).

## Volgorde van werken

Werk in deze volgorde. Stop niet bij een stap; ga door tot alle stappen klaar zijn.

1. **Projectinitialisatie**
   - `npm init -y`, `package.json` inrichten als ES-module (`"type": "module"`).
   - Installeer: `@modelcontextprotocol/sdk` als dependency; `typescript` en `@types/node` als
     devDependencies.
   - Scripts: `build` (`tsc`), `typecheck` (`tsc --noEmit`), `start` (`node dist/index.js`).
   - Controleer welke MCP-SDK-versie geïnstalleerd is en gebruik de API van die versie.

2. **`tsconfig.json`**
   - `strict: true`, `target` en `module` passend bij de geïnstalleerde Node-versie, `outDir:
     "dist"`, `rootDir: "src"`, `declaration: false`, `sourceMap: false`.
   - Zorg dat `npx tsc --noEmit` later schoon is.

3. **`src/dice.ts` — de kern**
   - Eén geëxporteerde functie die `sides` ontvangt en de uitkomst teruggeeft, plus de
     validatieregels als eigen, hergebruikbare functie.
   - Volledig synchroon, geen I/O, geen MCP-import. Hierdoor blijft de logica later zonder MCP
     testbaar.
   - Gebruik `crypto.randomInt(1, sides + 1)` uit `node:crypto`: gelijk verdeeld en niet voorspelbaar.
     Gebruik **niet** `Math.random()`.
   - Gooi bij ongeldige invoer een eigen `DiceError` met een **foutcode** (bijvoorbeeld
     `INVALID_SIDES`, `NOT_AN_INTEGER`, `TOO_FEW_SIDES`, `OUT_OF_RANGE`) plus de ontvangen waarde —
     nog geen vaste tekst. De kern hoeft de taal niet te kennen; het vertalen naar een leesbare
     melding gebeurt in `index.ts`.

4. **`src/index.ts` — de MCP-laag**
   - Maak een `McpServer` met een duidelijke `name` en `version`.
   - Registreer `roll_dice` met een beschrijving en een input-schema waarin `sides` als integer met
     ondergrens 2 is beschreven, en `lang` als optionele string.
   - Schrijf in de toolbeschrijving welke `sides` waarden geldig zijn **én** dat het model bij een
     foutmelding `lang` mee moet sturen gelijk aan de taal van het gesprek van de gebruiker. Dit is
     het enige kanaal waarlang de taal de server bereikt: de server ziet de oorspronkelijke prompt
     niet.
   - Bouw een foutcatalogus in `index.ts`: per foutcode een Nederlandse én een Engelstalige melding.
     Ondersteun in elk geval `en` en `nl`; val terug op Engels bij ontbrekende of onbekende `lang`,
     en bij een niet-ondersteunde code taalneutrale tekst.
   - Wikkel de aanroep vanuit `dice.ts` in `try/catch` en vertaal `DiceError` naar een response met
     `isError: true` en de melding in de gekozen taal. Erger: log intern naar `stderr`, geen
     `console.log` — **stdout is het MCP-kanaal**, en daar komt niets anders op.
   - Verbind met `StdioServerTransport` in een `main()` met foutafhandeling.
   - Geen `unhandledRejection`- of `uncaughtException`-handlers die het proces stilzwijgend
     laten doorgaan.

5. **`AGENTS.md` en `tasks.md`**
   - `AGENTS.md` (Nederlands): wat dit project is, de stack, de structuur, de
     commando's (`install`, `build`, `typecheck`, `start`, smoke test), conventies, en de
     niet-doen-lijst.
   - `tasks.md` (Nederlands): de concrete taken als afvinkbare checklist in dezelfde volgorde als
     hierboven, met een korte acceptatiecheck per taak.

6. **`opencode.json` — lokale MCP-registratie**
   - Maak `dice-server/opencode.json` met een `mcp`-blok waarin `dice-server` staat als lokale MCP
     die `node dist/index.js` start.
   - Gebruik `"type": "local"`, een `command`-array, en `"enabled": true`.
   - `dist/index.js` moet dus al bestaan: registreer pas nadat stap 4 klaar is, of bouw daarna.

7. **Verificatie**
   - `npm run build` en `npm run typecheck` moeten schoon zijn.
   - Smoke test over stdio (nog geen vitest, die komt later): start het proces, stuur
     `initialize`, `tools/list` en meerdere `tools/call`-verzoeken voor `roll_dice` met `sides` = 6,
     20, 100 (geldig) en 1, 0, `-4`, `2.5`, `"twintig"` en zonder parameter (ongeldig).
   - Herhaal elke ongeldige aanroep bovendien met `lang: "nl"` en met `lang: "en"`, en controleer dat
     de melding telkens in die taal is.
   - Controleer expliciet: geldige aanroepen geven steeds een geheel getal binnen `1..sides`;
     ongeldige aanroepen geven `isError` met een leesbare melding in de taal van `lang`;
     **na** elke ongeldige aanroep werkt een volgende geldige aanroep nog steeds.
   - Rapporteer de uitkomst van de smoke test in je eindbericht.

## Acceptatiecriteria

Alles hieronder moet waar zijn voordat je klaar bent:

- [ ] `npm run typecheck` geeft geen fouten.
- [ ] `npm run build` levert `dist/index.js` op.
- [ ] `tools/list` toont exact één tool: `roll_dice`.
- [ ] `roll_dice` met `sides: 20` geeft altijd een geheel getal tussen 1 en 20 inclusief.
- [ ] Elke ongeldige invoer uit de lijst hierboven geeft een foutrespons met `isError: true` en een
      leesbare melding.
- [ ] Die melding volgt `lang`: `"nl"` geeft Nederlands, `"en"` geeft Engels, en ontbrekende of
      onbekende `lang` geeft Engels.
- [ ] De uitkomst van een geldige aanroep is een getal en dus niet taalgebonden.
- [ ] Het proces blijft na een ongeldige aanroep draaien en de volgende aanroep slaagt.
- [ ] Er komt niets anders dan MCP-protocolverkeer op `stdout`.
- [ ] `opencode.json` staat lokaal in `dice-server/` en start `dist/index.js`.
- [ ] `AGENTS.md`, `tasks.md` en `uitleg.md` bestaan en zijn in het Nederlands.

## Niet doen

- Geen derde tool toevoegen; `roll_dice` en `flip_coin` zijn de enige twee.
- Geen HTTP- of SSE-transport; alleen stdio.
- Geen vitest of testframework nu — alleen `tsc --noEmit` en een smoke test.
- Geen over-engineering: geen dependency-injectie-laag, geen configuratiebestand, geen framework
  zoals Express, geen build-tool behalve `tsc`.
- Geen `secrets`, API-sleutels of netwerkverzoeken; de server doet niets anders dan dobbelen.
- `dist/` en `node_modules/` niet in git opnemen; niet committen tenzij daarom gevraagd.