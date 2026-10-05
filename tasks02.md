# Taken ronde 2: `flip_coin`

Uitbreiding van `dice-server` met een tweede tool: `flip_coin`. Deze ronde is een aparte lijst;
`tasks.md` blijft de bron van waarheid voor ronde 1 (`roll_dice`). Vink hieronder af wat klaar is en
werk van boven naar beneden.

Scope van deze ronde: `src/coin.ts`, `src/index.ts`, `uitleg.md` en `prompt.md`. `opencode.json`
hoeft niet te veranderen, want het start nog steeds `node dist/index.js`.

**Contract in het kort:** `flip_coin(lang?: string)` neemt **geen invoervariabelen** voor de worp
zelf en geeft exact `kop` of `munt` terug in de taal uit `lang`. `lang` is optioneel en volgt exact
dezelfde regels als bij `roll_dice`.

## 0. Documentatie bijgewerkt

- [x] `AGENTS.md`: twee tools in plaats van één, aangepaste projectstructuur, toolcontract voor
      `flip_coin`, conventies voor munten en taal, aangepaste niet-doen-lijst
- [x] `tasks02.md`: dit bestand
- [x] `tasks.md`: verwijzing naar deze ronde

**Acceptatie:** `AGENTS.md` spreekt `roll_dice` en `flip_coin` tegenstrijdigloos, en `tasks.md` of
`AGENTS.md` bevat geen zin meer die een tweede tool verbiedt.

## 1. `src/coin.ts` — de kern

- [x] Nieuw bestand `src/coin.ts`, naast `dice.ts` en niet erin: een munt is geen dobbelsteen en de
      bestandsnaam hoort bij de taal die erin staat
- [x] `export type CoinSide = 'heads' | 'tails'` — de kern is taalneutraal en spreekt geen
      Nederlands of Engels
- [x] `export function flip(): CoinSide` met `randomInt(0, 2)` uit `node:crypto`: `0` geeft
      `'heads'`, `1` geeft `'tails'`. `randomInt` is bovenwaarde, dus beide kanten zijn even
      waarschijnlijk. **Nooit** `Math.random()`
- [x] Geen parameters, dus geen validatie en geen `CoinError`. Niet toegevoegd "voor de
      symmetrie": een functie zonder invoer heeft niets te valideren
- [x] Volledig synchroon, geen I/O, geen MCP-import, alleen `node:crypto`
- [x] Geen comments in de broncode; de uitleg van dit ontwerp hoort in stap 6

**Acceptatie:** het bestand importeert niets van het MCP-SDK, gebruikt `randomInt`, en 1000
aanroepen geven uitsluitend `'heads'` of `'tails'`, waarbij beide waarden voorkomen.

Uitgevoerd: `npm run typecheck` schoon, `npm run build` levert `dist/coin.js`. De kern direct
getest — 1000 aanroepen gaven uitsluitend `'heads'` of `'tails'`, beide aanwezig.

## 2. `src/index.ts` — de MCP-laag

- [x] Controleer eerst de API van de geïnstalleerde SDK-versie in `node_modules` voordat je code
      schrijft, net als bij ronde 1
- [x] `CoinSide` naar een woord vertalen in één mapping in `index.ts`, naar hetzelfde principe als de
      foutcatalogus: alle tekst die de gebruiker leest staat op één plek in de MCP-laag. Vier regels,
      geen aparte module, geen enum-klasse:

  | uitkomst | `en` | `nl` |
  | --- | --- | --- |
  | `'heads'` | `heads` | `kop` |
  | `'tails'` | `tails` | `munt` |

- [x] `lang` hergebruiken: `toLanguage(lang)` bestaat al en wordt gedeeld. Geen tweede
      taalfunctie, geen nieuwe taalconstanten
- [x] `flip_coin` registreren met `server.registerTool`, met een beschrijving die het model vertelt
      wanneer hij deze tool gebruikt ("gooi een munt op", "kant of munt", "flip a coin") en die
      uitlegt dat er geen zijden of andere parameters zijn, alleen `lang`
- [x] Inputschema met **alleen** `lang: z.unknown().optional()`, met dezelfde `describe`-tekst als
      bij `roll_dice`. Geen `sides`, geen `count`, geen varianten of probabilities
- [x] Response: één `text`-blok met exact het woord `kop` of `munt` (of `heads`/`tails`), zodat het
      model het direct kan gebruiken in zijn antwoord
- [x] `try/catch` om de aanroep, ook al is er niets te valideren. Een onverwachte fout geeft
      `isError: true` met een leesbare melding; het proces mag niet crashen
- [x] Geen logging van de uitkomst naar `stderr` of elders; diagnostische uitvoer blijft op `stderr`
      en `stdout` blijft het MCP-kanaal

**Acceptatie:** `npm run typecheck` is schoon, `npm run build` levert `dist/index.js`, en
`tools/list` toont twee tools.

Uitgevoerd: `npm run typecheck` schoon, `npm run build` levert `dist/index.js`.

## 3. Zo niet

- [x] `flip_coin` wordt **niet** als tweede argument aan `roll_dice` hangen en niet als
      `roll_dice` met `sides: 2` vervangen: het model moet beide tools zelfstandig kunnen kiezen
- [x] Geen invoervariabelen toegevoegd aan `flip_coin`: geen `sides`, geen aantal flips, geen
      gewichten of kansen, geen eigen taalparameter buiten `lang`
- [x] Geen derde tool, ook niet vooruitlopend
- [x] Geen HTTP- of SSE-transport, geen testframework, geen over-engineering

**Acceptatie:** de diff bevat geen extra parameters op `flip_coin` en geen nieuwe tool.

## 4. Documentatie bijwerken

- [x] `uitleg.md`: de tabel met bestanden krijgt een regel voor `src/coin.ts`; een "waarom"-regel
      waarom de kern `'heads' | 'tails'` teruggeeft in plaats van `kop`/`munt`, en waarom de
      vertaling in `index.ts` staat; de tekst "precies één tool" wordt twee tools; de lijst van
      ondersteunende bestanden noemt `tasks02.md`
- [x] `prompt.md`: de zinnen "precies één tool" en de niet-doen-regel "Geen tweede tool toevoegen"
      gelden niet meer voor deze staat van de server. Noteer daar dat `flip_coin` inmiddels bestaat,
      zodat het contract van ronde 1 niet meer in tegenspraak is met de code
- [x] `AGENTS.md` nogmaals nalopen: overal twee tools, overal `flip_coin(lang?)`, overal de regel
      dat de kern taalneutraal is

**Acceptatie:** geen enkel document bevat nog de claim dat de server precies één tool heeft, en geen
enkel document verbiedt `flip_coin` nog.

## 5. Verificatie

- [x] `npm run typecheck` schoon
- [x] `npm run build` levert `dist/index.js`
- [x] `tools/list` toont twee tools: `roll_dice` en `flip_coin`, elk met een bruikbare beschrijving
      en een inputschema met alleen `lang`
- [x] Smoke test over stdio: `flip_coin` met `{}` geeft een van de twee woorden
- [x] Smoke test: 1000 aanroepen geven uitsluitend `kop` of `munt`, beide komen voor, en de
      verdeling ligt tussen 40% en 60%
- [x] Smoke test: `lang: "nl"` geeft `kop` of `munt`; `lang: "en"` geeft `heads` of `tails`
- [x] Smoke test: ontbrekende `lang` en onbekende `lang` (`"de"`, `"fr"`) geven Engels;
      `lang: "nl-BE"` geeft Nederlands
- [x] Smoke test: `roll_dice` werkt nog steeds, zowel vóór als ná een `flip_coin`-aanroep
- [x] Smoke test: er komt niets anders dan MCP-protocolverkeer op `stdout`
- [x] Uitkomst van de smoke test gerapporteerd in het eindbericht, met een kleine tabel zoals in
      `tasks.md`

**Acceptatie:** alle bovenstaande punten zijn afgevinkt en de server is end-to-end werkend met twee
tools.

Smoke test over stdio: 11 checks, allemaal geslaagd. Server start met protocol `2025-06-18`,
`serverInfo` is `dice-server 1.0.0`. Selectie uit de uitkomsten:

| Aanroep | Resultaat |
| --- | --- |
| `flip_coin {}` | `heads` (terugval Engels) |
| `flip_coin lang: "nl"` | `munt` |
| `flip_coin lang: "en"` | `tails` |
| `flip_coin lang: "de"` | `heads` (terugval Engels) |
| `flip_coin lang: "nl-BE"` | `munt` |
| 1000× `flip_coin lang: "nl"` | kop=517, munt=483 |
| `roll_dice sides: 6` | `4` |

Het smoke script stond in de temp-map en is bewust niet in het project opgenomen; zie "Later".

## 6. Verificatie van de kern, los van MCP

- [x] Direct `src/coin.ts` testen zonder MCP-client: 1000 flips, alleen `'heads'` en `'tails'`,
      beide aanwezig
- [x] Controleren dat de module geen MCP-import heeft en geen `Math.random()`

**Acceptatie:** beide punten slagen; daarmee is bewezen dat de kern net zo los testbaar is als
`dice.ts`.

## Later (nu niet bouwen)

- [ ] Vitest-tests voor `src/dice.ts` en `src/coin.ts`, zonder MCP-client
- [ ] Een geautomatiseerd smoke testscript in het project, in plaats van handmatig JSON-RPC sturen
- [ ] Meerdere munten in één aanroep (`count`) of een andere variant dan kop/munt — pas als er
      een echte aanleiding is; beide zijn nu bewust uitgesloten