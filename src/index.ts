import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod';

import { DiceError, MAX_SIDES, roll, validateSides } from './dice.js';
import type { DiceErrorCode } from './dice.js';
import { flip } from './coin.js';
import type { CoinSide } from './coin.js';

const SERVER_NAME = 'dice-server';
const SERVER_VERSION = '1.0.0';

type Language = 'en' | 'nl';

type Message = (received: unknown) => string;

interface CatalogEntry {
  neutral: Message;
  en: Message;
  nl: Message;
}

type Catalog = Record<DiceErrorCode, CatalogEntry>;

type CoinWords = Record<CoinSide, string>;

const coinWords: Record<Language, CoinWords> = {
  en: { heads: 'heads', tails: 'tails' },
  nl: { heads: 'kop', tails: 'munt' },
};

const catalog: Catalog = {
  NOT_AN_INTEGER: {
    neutral: (received) => `sides must be a whole number, received ${format(received)}.`,
    en: (received) => `sides must be a whole number, received ${format(received)}.`,
    nl: (received) =>
      `sides moet een geheel getal zijn, ontvangen ${format(received)}. Gebruik een geheel getal van 2 tot ${MAX_SIDES}.`,
  },
  TOO_FEW_SIDES: {
    neutral: (received) => `sides must be at least 2, received ${format(received)}.`,
    en: (received) => `sides must be at least 2, received ${format(received)}.`,
    nl: (received) =>
      `sides moet minstens 2 zijn, ontvangen ${format(received)}. Een dobbelsteen heeft minstens twee kanten.`,
  },
  OUT_OF_RANGE: {
    neutral: (received) => `sides must be at most ${MAX_SIDES}, received ${format(received)}.`,
    en: (received) => `sides must be at most ${MAX_SIDES}, received ${format(received)}.`,
    nl: (received) =>
      `sides mag maximaal ${MAX_SIDES} zijn, ontvangen ${format(received)}.`,
  },
  INVALID_SIDES: {
    neutral: (received) => `sides is invalid, received ${format(received)}.`,
    en: (received) => `sides is invalid, received ${format(received)}.`,
    nl: (received) => `sides is ongeldig, ontvangen ${format(received)}.`,
  },
};

function format(value: unknown): string {
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'nothing';
  }
  return JSON.stringify(value) ?? 'unknown';
}

function toLanguage(lang: unknown): Language {
  if (typeof lang !== 'string') {
    return 'en';
  }
  const base = lang.trim().toLowerCase().split('-')[0];
  return base === 'nl' ? 'nl' : 'en';
}

function translate(error: DiceError, lang: Language): string {
  const entry: CatalogEntry | undefined = catalog[error.code];
  const message = entry === undefined ? catalog.INVALID_SIDES.neutral : entry[lang];
  return message(error.received);
}

const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

server.registerTool(
  'roll_dice',
  {
    description:
      'Roll a single die and return one whole number between 1 and the number of sides, both included. ' +
      `Pass the number of sides the user asked for as "sides": a whole number from 2 to ${MAX_SIDES}. ` +
      'If the user asks for a die that cannot exist, such as a 4.3-sided or 1-sided die, do not round or ' +
      'guess: call this tool anyway and report the returned error message back to the user. ' +
      'Always pass the language of the user conversation as "lang" ("en" or "nl") so that any error ' +
      'message comes back in the language the user wrote in.',
    inputSchema: {
      sides: z
        .unknown()
        .optional()
        .describe(
          `Required. The number of sides the user asked for: a whole number from 2 to ${MAX_SIDES}.`,
        ),
      lang: z
        .unknown()
        .optional()
        .describe("The language of the user conversation: 'en' or 'nl'."),
    },
  },
  ({ sides, lang }) => {
    const language = toLanguage(lang);
    try {
      const value = roll(validateSides(sides));
      return { content: [{ type: 'text', text: String(value) }] };
    } catch (error) {
      if (error instanceof DiceError) {
        return {
          content: [{ type: 'text', text: translate(error, language) }],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text', text: `unexpected error: ${String(error)}` }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'flip_coin',
  {
    description:
      'Flip a coin and return the outcome: "kop" or "munt" in Dutch, "heads" or "tails" in English. ' +
      'There are no parameters for the flip itself. ' +
      'Always pass the language of the user conversation as "lang" ("en" or "nl") so that the ' +
      'outcome comes back in the language the user wrote in.',
    inputSchema: {
      lang: z
        .unknown()
        .optional()
        .describe("The language of the user conversation: 'en' or 'nl'."),
    },
  },
  ({ lang }) => {
    const language = toLanguage(lang);
    try {
      const side = flip();
      return { content: [{ type: 'text', text: coinWords[language][side] }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `unexpected error: ${String(error)}` }],
        isError: true,
      };
    }
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  process.stderr.write(`[${SERVER_NAME}] failed to start: ${String(error)}\n`);
  process.exit(1);
});