# Uitleg

## Wat

`dice-server` is een MCP-server die precies twee tools aanbiedt: `roll_dice` en `flip_coin`. Zodra de
server bij opencode is geregistreerd, kan het model zelfstandig dobbelstenen rolen en munten
opgooien. De prompt *"gooi een 20-zijdige dobbelsteen"* leidt daardoor automatisch tot een aanroep
van `roll_dice` met `sides: 20`; *"gooi een munt op"* tot `flip_coin`.

De server bestaat uit drie bestanden:

| Bestand | Rol |
| --- | --- |
| `src/dice.ts` | De kern voor dobbelen: controleert `sides` en gooit de dobbelsteen. Pure functie, geen MCP-import. |
| `src/coin.ts` | De kern voor munten: gooit de munt. Pure functie, geen MCP-import. |
| `src/index.ts` | De MCP-laag: maakt de server aan, registreert de tools, vertaalt uitkomsten en fouten naar responses, koppelt stdio. |

De tool `roll_dice` krijgt twee parameters: `sides` (het aantal kanten) en `lang` (de taal waarin
eventuele foutmeldingen moeten worden gegeven). Bij een Engelse prompt is de foutmelding Engels; bij
*"gooi een 4,3-zijdige dobbelsteen"* is hij Nederlands. Ontbreekt `lang`, dan valt de server terug
op Engels. De uitkomst van een geldige aanroep is een getal en daarmee taalneutraal.

De tool `flip_coin` krijgt alleen `lang` en geen invoervariabelen voor de worp zelf. Zij geeft `kop`
of `munt` terug in de taal van de gebruiker, of `heads`/`tails` bij het Engels. Omdat de uitkomst
hier wél taalgebonden is, geeft de kern in `coin.ts` de taalneutrale waarde `'heads' | 'tails'`
terug en vertaalt `index.ts` die naar het juiste woord — precies zoals de foutcatalogus alleen in
`index.ts` staat.

`opencode.json` in deze map registreert de server als lokale MCP die `node dist/index.js` start. Die
verwijst naar de build-uitvoer, dus `npm run build` moet eerst gedraaid zijn.

De overige bestanden zijn ondersteunend: `package.json` en `tsconfig.json` voor de build,
`opencode.json` voor de registratie in opencode, `AGENTS.md`, `tasks.md` en `tasks02.md` als
werkdocumenten, `.gitignore` voor `dist/` en `node_modules/`.

## Waarom

**Waarom MCP.** MCP is het protocol waarmee een model tools aanroept die buiten het model zelf
liggen. Een gewone functie aanroepen kan een model niet; een geregistreerde tool wel. De server
is daarmee de plek waar de willekeurige kant van het model wordt vervangen door echte code.

**Waarom `crypto.randomInt`.** `Math.random()` is niet gelijk verdeeld over alle gehele getallen en
is voorspelbaar. `crypto.randomInt(1, sides + 1)` geeft wél een gelijk verdeelde waarde en is
cryptografisch; voor een dobbelsteen is dat het juiste niveau, ook omdat een model anders voorspelbare
uitkomsten kan leren nabootsen.

**Waarom twee bestanden.** De kern in `dice.ts` en `coin.ts` kent geen MCP en geen I/O. Daardoor
is de validering later los te testen (met vitest, in een volgende ronde) zonder een MCP-client op te
zetten. `index.ts` houdt zich bezig met wat MCP-specifiek is. Hoe dunner die scheiding, hoe
goedkoper het testen later.

**Waarom een apart `coin.ts`.** Een munt is geen dobbelsteen, en de bestandsnaam hoort bij de taal
die erin staat. Samenvoegen in `dice.ts` levert alleen een bestand met twee onderwerpen.

**Waarom een los inputschema.** Het schema van de tool beschrijft `sides` en `lang` alleen met een
`description`, niet met `type: integer` of een minimum. Een strak schema zou schoner lijken, maar het
SDK zou dan zelf ingrijpen: `sides: 2.5` zou een Engelse `MCP error -32602` teruggeven en de Nederlandse
foutcatalogus wordt nooit geraakt. Door het schema open te laten, doet `dice.ts` de validatie en
vertalen wij de foutcode naar een melding in de taal van de gebruiker. De keerzijde is dat de
geldigheid van `sides` in de beschrijving staat en niet in het schema, dus die tekst is onderdeel van
het contract en moet actueel blijven.

**Waarom een foutmelding in de taal van de gebruiker.** Een gebruiker die zijn instructie in het
Engels geeft, wil de foutmelding ook in het Engels teruglezen. De server kan die taal zelf echter
niet bepalen: een MCP-tool ziet alleen de parameters die het model meegeeft, niet het bericht van de
gebruiker. Het model ziet dat bericht wél. Daarom heeft de tool een optionele parameter `lang`, en
staat in de toolbeschrijving dat het model daar de taal van het gesprek in moet doorgeven. Ontbreekt
de parameter of is de code onbekend, dan wordt Engels gebruikt — een veilige default, en het enige
wat een server zonder context kan doen. Dezelfde regel geldt voor een onmogelijke dobbelsteen: bij
*"throw a 4,3-sided dice"* zegt de beschrijving tegen het model dat het de tool toch moet aanroepen
en de foutmelding moet teruggeven, in plaats van zelf af te ronden naar 4.

**Waarom de muntkern taalneutraal is.** `flip_coin` geeft `kop` of `munt` terug in de taal van de
gebruiker, maar die woorden horen niet in `coin.ts`. De kern geeft `'heads' | 'tails'` terug —
taalneutraal, net als het getal bij `roll_dice` — en `index.ts` vertaalt die uitkomst naar het
juiste woord. Zo blijft de regel "alle tekst staat in de MCP-laag" ook gelden voor een uitkomst die
wél taalgebonden is, en blijft de kern los testbaar.

**Waarom fouten als codes en niet als teksten.** De kern in `dice.ts` gooit een `DiceError` met een
code als `OUT_OF_RANGE`, niet met een vaste Engelse zin. Zo staat de kern niet vast aan één taal en
kan `index.ts` uit dezelfde code een Nederlandse én een Engelstalige melding maken. Voorkomt ook
dat er twee plekken ontstaan die "de" foutmelding bevatten.

**Waarom een foutrespons in plaats van een exception.** Een MCP-tool wordt door een model
aangeroepen, dus de invoer is per definitie onbetrouwbaar. Als een exception ongehandeld ontsnapt,
breekt het proces af en is de server voor de hele sessie weg — één verkeerde aanroep van het model
legt dan het hele spel stil. Daarom geeft `dice.ts` een `DiceError` met een foutcode en vangt
`index.ts` die op: het model krijgt een leesbare foutmelding terug in de taal van het gesprek en kan
het opnieuw proberen met een geldige waarde, terwijl de server in de lucht blijft.

**Waarom stdout leeg blijft.** Over stdio is `stdout` het MCP-kanaal. Een `console.log` op een
verkeerd moment injecteert rommel in het protocol en maakt de verbinding stuk. Diagnostische
uitvoer hoort naar `stderr`.

## Volgorde

1. **`npm init` en dependencies** — zonder SDK en TypeScript is er niets om mee te beginnen.
2. **`tsconfig.json`** — ligt vast vóór de eerste regel code, zodat `strict` meteen geldt en
   achteraf geen fouten meer te herstellen zijn.
3. **`src/dice.ts`** — eerst de kern. De regels zijn hier het duidelijkst, en ze zijn los
   controleerbaar zonder een draaiende server.
4. **`src/index.ts`** — de MCP-laag eromheen: toolregistratie, foutcatalogus per taal, stdio-connect.
5. **`AGENTS.md`, `tasks.md` en `tasks02.md`** — de documentatie vastgelegd terwijl de beslissingen
   nog vers zijn, dus niet uit het geheugen gereconstrueerd.
6. **`opencode.json`** — registratie in opencode verwijst naar `dist/index.js`. Die uitvoer moet
   eerst bestaan, anders start de MCP-server niet.
7. **Verificatie** — typecheck, build en smoke test over stdio. Tot slot, want zonder een werkende
   uitvoer is er niets te testen. De smoke test stuurt echte `initialize`- en `tools/call`-berichten
   over `stdin`, omdat een server die alleen bouwt nog niet bewezen heeft dat hij in een gesprek
   werkt.

De rode draad: eerst de regels, dan de laag eromheen, dan de documentatie, dan de koppeling aan
opencode, en als laatste de controle of het allemaal klopt.