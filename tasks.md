# Taken

Voortgang van de bouw van `dice-server`. Volgorde zoals in `prompt.md`. Vink af wat klaar is.

Ronde 2 (de tweede tool `flip_coin`) staat in `tasks02.md`.

## 1. Projectinitialisatie

- [x] `prompt.md` geschreven: opdracht, contract, volgorde, acceptatiecriteria
- [x] `uitleg.md` geschreven: wat, waarom, in welke volgorde
- [x] `AGENTS.md` geschreven: project, stack, structuur, commando's, conventies
- [x] `npm init -y` en `package.json` als ES-module (`"type": "module"`)
- [x] `@modelcontextprotocol/sdk` geïnstalleerd als dependency (`1.32.0`)
- [x] `typescript` en `@types/node` geïnstalleerd als devDependencies (`7.0.2`, `26.6.4`)
- [x] Scripts `build`, `typecheck` en `start` aanwezig
- [x] Geïnstalleerde SDK-versie gecontroleerd; `McpServer` uit
      `@modelcontextprotocol/sdk/server/mcp.js`, `StdioServerTransport` uit `.../server/stdio.js`
- [x] `.gitignore` voor `node_modules/` en `dist/`

**Acceptatie:** `npm install` slaagt en `npm run typecheck` draait zonder foutmelding over de
configuratie.

## 2. `tsconfig.json`

- [x] `strict: true`, plus `noUncheckedIndexedAccess`
- [x] `target: ES2022`, `module`/`moduleResolution: NodeNext` (SDK is ESM, vereist `>=18`)
- [x] `outDir: "dist"`, `rootDir: "src"`
- [x] Geen `declaration`, geen `sourceMap` (niet nodig voor deze server)

**Acceptatie:** `npm run typecheck` is schoon en `npm run build` schrijft `dist/` op.

## 3. `src/dice.ts` — de kern

- [x] `validateSides(sides: unknown): number` die het gehele getal teruggeeft of een `DiceError` gooit
- [x] Foutcodes `NOT_AN_INTEGER`, `TOO_FEW_SIDES`, `OUT_OF_RANGE`, plus `MAX_SIDES = 10_000`
- [x] `DiceError` bevat de code en de ontvangen waarde, geen vaste tekst
- [x] `roll(sides: number): number` die `randomInt(1, sides + 1)` gebruikt
- [x] Volledig synchroon, geen I/O, geen MCP-import

**Acceptatie:** de module importeert niets van het MCP-SDK, gebruikt `randomInt` (niet
`Math.random()`), en valideert `1`, `0`, `-4`, `2.5`, `NaN`, `Infinity` en `"twintig"` af.

Uitgevoerd: `npm run typecheck` schoon, `npm run build` levert `dist/dice.js`. De kern direct
getest — `1`/`0`/`-4` geven `TOO_FEW_SIDES`, `2.5`/`NaN`/`Infinity`/`"twintig"`/`null`/`true`/
`undefined` geven `NOT_AN_INTEGER`, `10_001` geeft `OUT_OF_RANGE`, 5000 worpen met 6 zijden blijven
in 1–6.

## 4. `src/index.ts` — de MCP-laag

- [x] `McpServer` aangemaakt met `name` en `version`
- [x] `roll_dice` geregistreerd met beschrijving en inputschema
- [x] Beschrijving noemt de geldigheid van `sides`, verbiedt afronden bij onmogelijke dobbelstenen en
      instrueert het model om `lang` mee te sturen
- [x] Foutcatalogus: per code een Nederlandse en een Engelstalige melding, plus een taalneutrale
      variant als terugval voor onbekende codes
- [x] `lang` afgehandeld: `en` en `nl` ondersteund, `nl-BE`-achtige codes via de basiscode,
      onbekende code valt terug op Engels
- [x] `try/catch` rond de aanroep; `DiceError` wordt een response met `isError: true`
- [x] Interne logging naar `stderr`, niets naar `stdout`
- [x] `StdioServerTransport` gekoppeld in een `main()` met foutafhandeling

**Acceptatie:** na een ongeldige aanroep draait het proces nog en werkt een volgende aanroep.

Uitgevoerd: `npm run typecheck` schoon, `npm run build` levert `dist/index.js`.

Waarom het inputschema `z.unknown().optional()` is en niet `z.number().int().min(2)`: het SDK zou
ongeldige invoer dan zelf afwijzen met eenEngelse `MCP error -32602`-melding, waardoor de
Nederlandse foutcatalogus nooit wordt geraakt. Met `unknown` doet `dice.ts` de validatie en krijgt de
catalogus de taalkeuze. Het gevolg is dat het schema alleen `description` meekrijgt en geen
`type`/`minimum`; de geldigheid van `sides` staat daarom in de beschrijving.

## 5. `opencode.json` — lokale MCP-registratie

- [x] `opencode.json` in `dice-server/` met een `mcp`-blok
- [x] `dice-server` staat erin als lokale MCP met `"type": "local"` en `"enabled": true`
- [x] `command` is een array die `node dist/index.js` start
- [x] Verwijst naar de uitvoer uit stap 4

**Acceptatie:** opencode toont `dice-server` als verbonden MCP-server en de tool is aanroepbaar.

## 6. Verificatie

- [x] `npm run typecheck` schoon
- [x] `npm run build` levert `dist/index.js`
- [x] `tools/list` toont exact één tool: `roll_dice`
- [x] Smoke test: geldige aanroepen met `sides` = 6, 20, 100 en 2 geven steeds een geheel getal
      binnen `1..sides`
- [x] Smoke test: ongeldige aanroepen met `sides` = 1, 0, `-4`, `2.5`, `"twintig"`, `null` en zonder
      parameter geven `isError: true` met een leesbare melding
- [x] Smoke test: dezelfde ongeldige aanroepen met `lang: "nl"` geven een Nederlandse melding en met
      `lang: "en"` een Engelse
- [x] Smoke test: onbekende `lang` (`"de"`) valt terug op Engels
- [x] Smoke test: **na** elke ongeldige aanroep werkt een volgende geldige aanroep nog steeds
- [x] Uitkomst van de smoke test gerapporteerd in het eindbericht

**Acceptatie:** alle bovenstaande punten zijn afgevinkt en de server is end-to-end werkend.

Smoke test over stdio: 24 checks, allemaal geslaagd. Server start met protocol `2025-06-18`,
`serverInfo` is `dice-server 1.0.0`. Selectie uit de uitkomsten:

| Aanroep | Resultaat |
| --- | --- |
| `sides: 6` | `3` |
| `sides: 20` | `14` |
| `sides: 1` | `sides must be at least 2, received 1.` |
| `sides: 4.3, lang: "en"` | `sides must be a whole number, received 4.3.` |
| `sides: 4.3, lang: "nl"` | `sides moet een geheel getal zijn, ontvangen 4.3. Gebruik een geheel getal van 2 tot 10000.` |
| `sides: 20000, lang: "nl"` | `sides mag maximaal 10000 zijn, ontvangen 20000.` |
| `sides: 1, lang: "de"` | `sides must be at least 2, received 1.` (terugval Engels) |

De laatste geldige aanroep na 13 ongeldige gaf gewoon `4`. Het smoke script stond in de temp-map en
is bewust niet in het project opgenomen; zie "Later".

## Later (nu niet bouwen)

- [ ] Vitest-tests voor `src/dice.ts`, zonder MCP-client
- [ ] Een geautomatiseerd smoke testscript in plaats van handmatig JSON-RPC sturen. De kern van het
      gebruikte script: spawn `node dist/index.js`, stuur `initialize` met protocol `2025-06-18`,
      daarna `notifications/initialized` en `tools/call`, match responses op `id`. Stuur de
      requests één voor één en wacht op het antwoord; alle requests in één keer sturen werkt niet
      omdat de eerste `initialize` pas de server klaarzet.