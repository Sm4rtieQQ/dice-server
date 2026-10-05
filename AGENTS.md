# AGENTS.md

## Wat is dit

`dice-server` is een MCP-server die dobbelstenen rolt en munten opgooit. De server biedt precies twee
tools aan: `roll_dice` en `flip_coin`. Zodra de server bij opencode is geregistreerd, kan het model
zelfstandig spelen: de prompt *"gooi een 20-zijdige dobbelsteen"* leidt automatisch tot
`roll_dice` met `sides: 20`, en *"gooi een munt op"* tot `flip_coin`.

Het doel is bewust klein: twee tools, geen state, geen netwerk, geen database. Alles wat niet direct
nodig is om een getal tussen 1 en `sides`, of `kop` of `munt`, te leveren, hoort er niet in.

## Stack

- **TypeScript**, strikt (`strict: true`).
- **npm** voor installatie, scripts en versiebeheer.
- **`@modelcontextprotocol/sdk`** voor het MCP-protocol. Gebruik de API van de geïnstalleerde
  versie; controleer die na installatie in `node_modules` voordat je code schrijft.
- **stdio** als transport. Geen HTTP, geen SSE.

## Projectstructuur

```
dice-server/
├── src/
│   ├── index.ts        # MCP-server: toolregistratie, foutcatalogus, vertaling, stdio-connect
│   ├── dice.ts         # kern dobbelen: validatie + dobbelen, pure functie, geen MCP-import
│   └── coin.ts         # kern munt: opgooien, pure functie, geen MCP-import
├── dist/               # build-uitvoer (gegenereerd, nooit handmatig bewerken)
├── package.json
├── tsconfig.json
├── .gitignore
├── opencode.json       # lokale MCP-registratie voor dit project
├── AGENTS.md           # dit bestand
├── tasks.md            # voortgang ronde 1 (roll_dice), taken in uitvoervolgorde
├── tasks02.md          # voortgang ronde 2 (flip_coin), taken in uitvoervolgorde
├── prompt.md           # opdracht en contract
└── uitleg.md           # korte uitleg van ontwerp en volgorde
```

De kern staat in `dice.ts` en `coin.ts`: die bevatten de regels en kennen geen MCP en geen I/O, zodat
ze later los te testen zijn zonder een MCP-client op te zetten. `index.ts` bevat alles wat
MCP-specifiek is, inclusief alle tekst die de gebruiker leest. Houd die scheiding streng: een kern
met een Nederlandse of Engelse uitkomst hoort niet in `dice.ts` of `coin.ts`.

Waarom een apart `coin.ts` en geen functie in `dice.ts`: een munt is geen dobbelsteen, en de
bestandsnaam hoort bij de taal die erin staat. Samenvoegen levert alleen een bestand met twee
onderwerpen.

## Commando's

Voer uit vanuit de map `dice-server/`.

| Commando | Doet |
| --- | --- |
| `npm install` | Installeert dependencies. |
| `npm run build` | Compileert `src/` naar `dist/`. Vereist vóór het starten van de server. |
| `npm run typecheck` | `tsc --noEmit`: types controleren zonder uitvoer te schrijven. |
| `npm start` | Start de server via `node dist/index.js`. |

De server is geen zelfstandig programma: hij leest JSON-RPC van `stdin` en schrijft naar `stdout`.
`npm start` in een lege terminal doet dus niets zichtbaars. Controleer de server daarom in twee
stappen:

1. **Typecheck en build** — `npm run typecheck` en `npm run build` moeten schoon zijn.
2. **Smoke test** — start het proces en stuur JSON-RPC-regels over `stdin`, of laat opencode de
   tool aanroepen. Er is nog geen geautomatiseerd testscript; dat komt later.

Voor de smoke test zijn deze aanroepen relevant: `initialize`, daarna `tools/list` (toont de twee
tools), daarna `tools/call` met `name: "roll_dice"` en verschillende waarden voor `sides`, en
`tools/call` met `name: "flip_coin"` met en zonder `lang`.

## Toolcontract

### `roll_dice(sides: integer, lang?: string)`

- `sides` is verplicht, een geheel getal, minimaal `2`.
- Resultaat is één geheel getal in `1..sides`, **inclusief** beide grenzen.
- `lang` is optioneel en bepaalt de taal van foutmeldingen: `en` of `nl`. Het model moet hier de
  taal van het gesprek van de gebruiker in doorgeven; de server ziet de oorspronkelijke prompt niet.
  Ontbreekt `lang` of is de code onbekend, dan geldt Engels.
- Een geldige uitkomst is een getal en dus taalneutraal; alleen foutmeldingen zijn taalgebonden.
- Ongeldige invoer geeft een response met `isError: true` en een leesbare melding. Het proces blijft
  daarna draaien en de volgende aanroep werkt gewoon.

### `flip_coin(lang?: string)`

- De tool heeft **geen invoervariabelen** voor de worp zelf. Geen `sides`, geen aantal flips, geen
  kansen of gewichten. Alleen `lang`, precies dezelfde parameter en dezelfde regels als bij
  `roll_dice`.
- Resultaat is één woord: `kop` of `munt` bij `nl`, `heads` of `tails` bij `en`. De uitkomst is
  dus wél taalgebonden, in tegenstelling tot het getal bij `roll_dice`.
- De kern in `coin.ts` geeft daarom `'heads' | 'tails'` terug en kent geen taal; `index.ts`
  vertaalt die uitkomst naar het juiste woord, net zoals de foutcatalogus.
- Er valt niets te valideren, dus `flip_coin` heeft geen eigen foutcodes. Een onverwachte fout geeft
  alsnog `isError: true` en het proces blijft draaien.

## Conventies

**Talen**

- Documentatie en tekstbestanden in het **Nederlands**.
- Code, identifiers en protocolfouten in het **Engels**.
- Foutmeldingen in de taal van de gebruiker (Nederlands of Engels), dus in een catalogus.
- Uitkomsten kunnen taalgebonden zijn (`kop`/`munt`); de kern geeft dan een taalneutrale waarde terug
  (`'heads' | 'tails'`) en vertaalt `index.ts` die naar het juiste woord.
- Geen overbodige comments in de broncode. Ontwerpuitleg hoort in `uitleg.md`, voortgang in
  `tasks.md` (ronde 1) en `tasks02.md` (ronde 2).

**Foutafhandeling**

- `dice.ts` gooit `DiceError` met een **code** (`NOT_AN_INTEGER`, `TOO_FEW_SIDES`, `OUT_OF_RANGE`,
  `INVALID_SIDES`, …) plus de ontvangen waarde — nooit met een vasteEngelse tekst.
- `index.ts` bezit de foutcatalogus: per code een Nederlandse en een Engelstalige melding, en
  een taalneutrale variant voor als er geen catalogusregel bestaat. Dat houdt de taalkeuze op één
  plek.
- Vang fouten altijd af en keer een MCP-errorrespons terug. Een exception die ongehandeld ontsnapt
  beëindigt het proces en legt de hele sessie plat voor één verkeerde aanroep van het model.
- Log intern naar `stderr`, nooit via `console.log`.

**Willekeur**

- Gebruik `crypto.randomInt(1, sides + 1)` uit `node:crypto`. Gebruik **nooit** `Math.random()`:
  dat is niet gelijk verdeeld over gehele getallen en is voorspelbaar.
- Voor de munt geldt hetzelfde: `crypto.randomInt(0, 2)` geeft `0` of `1`, beide even waarschijnlijk.

**Stijl**

- Twee spaties per inspringing, enkele aanhalingstekens, puntkomma's aan het eind van een regel.
- Types expliciet, geen `any`. `unknown` en typeguards boven casten.
- Houd functies kort en voer één ding uit. Validatie, dobbelen en vertalen zijn gescheiden stappen.
- Geen frameworks, configuratiebestanden of abstractielagen boven wat nodig is.

**Werkwijze**

- `tasks.md` is de bron van waarheid voor ronde 1 (`roll_dice`), `tasks02.md` voor ronde 2
  (`flip_coin`). Werk de lijst van boven naar beneden af en vink af wat klaar is.
- Werk in kleine stappen en verifieer iedere stap voordat je aan de volgende begint.

## Niet doen

- Geen derde tool toevoegen; `roll_dice` en `flip_coin` zijn de enige twee.
- Geen invoervariabelen toevoegen aan `flip_coin`; alleen `lang`.
- Geen HTTP- of SSE-transport; alleen stdio.
- Geen logs of andere uitvoer op `stdout`.
- Geen `Math.random()`, geen externe netwerkverzoeken, geen secrets of API-sleutels.
- Geen vitest of ander testframework zolang dat niet is gevraagd; nu volstaan `npm run typecheck`
  en de smoke test.
- Geen over-engineering: geen dependency injection, geen abstracte repository, geen build-tool
  behalve `tsc`.
- `dist/` en `node_modules/` niet in git opnemen.
- Niet committen tenzij daarom expliciet gevraagd is.