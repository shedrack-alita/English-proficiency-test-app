#!/usr/bin/env node
/**
 * Builds src/lib/seed-data/bank.json from the question files in content/.
 *
 *   node scripts/build-bank.mjs          build and report
 *   node scripts/build-bank.mjs --check  report only (exit 1 on errors)
 *
 * Question files (content/bank/*.txt) are line based:
 *
 *   # comment
 *   @topic Concord                  topic for the following questions (must be listed in TOPICS)
 *   @source EPTPREP practice        where the questions come from (shown in the results report)
 *   @instruction Choose the ...     instruction shown above each question
 *   @tip When ...                   tip shown in the results report (until changed; "@tip" alone clears)
 *   @mock ui2013                    also add the following questions, in order, to that mock paper ("@mock" alone stops)
 *   @passage                        start of a passage; every line up to "@end" is passage text
 *   @end
 *   @nopassage                      following questions have no passage
 *
 *   prompt | option | option | option | option || explanation || optional tip for this question
 *
 * Mark the correct option with a leading "*" to keep the options in the given order (used for papers
 * reproduced as published). Without a "*", the FIRST option is correct and the options are shuffled
 * deterministically. A fifth option is allowed for papers with options a–e; one wrong option is dropped.
 * Generators in content/generators/*.mjs export `default () => items[]` in the same shape.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = path.join(ROOT, "content");
const OUT = path.join(ROOT, "src", "lib", "seed-data", "bank.json");
const CHECK_ONLY = process.argv.includes("--check");

export const TOPICS = [
  "Word Class",
  "Register",
  "Concord",
  "Parallelism",
  "Standard Forms",
  "Discourse Reference",
  "Comprehension",
  "Spelling",
  "Capitalisation and Punctuation",
  "Tag Questions",
  "Collocation",
  "Lexis and Structure",
  "Tense and Aspect",
  "Stylistic Variation",
  "Sense Relation",
  "Synonyms and Antonyms",
  "Vocabulary in Context",
];

const errors = [];
const warnings = [];
const hash = (s) => createHash("sha1").update(s).digest("hex");

/** Deterministic shuffle so a rebuild produces the same answer letters. */
function shuffled(items, seed) {
  const out = [...items];
  let h = parseInt(hash(seed).slice(0, 8), 16);
  for (let i = out.length - 1; i > 0; i--) {
    h = (Math.imul(h ^ (h >>> 15), 2246822519) + 0x9e3779b9) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const FILLER = /^(none of (these|the above)|all of (these|the above)|both [ab] and [bc])\.?$/i;

/** Normalises one question: picks the answer, trims to four options, validates. */
function finalise(raw, where) {
  let options = raw.options.map((o) => o.trim()).filter((o) => o !== "");
  let answerIndex = options.findIndex((o) => o.startsWith("*"));
  const ordered = answerIndex >= 0;
  if (options.filter((o) => o.startsWith("*")).length > 1) errors.push(`${where}: more than one option marked with *`);
  options = options.map((o) => o.replace(/^\*\s*/, ""));
  if (!ordered) answerIndex = 0;
  if (options.length === 5) {
    // Drop one wrong option: a "None of these"-style filler if there is one, otherwise the first
    // wrong option (the last option is kept, e.g. "All are correctly spelt").
    let drop = options.findIndex((o, i) => i !== answerIndex && FILLER.test(o));
    if (drop < 0) drop = options.findIndex((_, i) => i !== answerIndex && i !== options.length - 1);
    options.splice(drop, 1);
    if (drop < answerIndex) answerIndex--;
  }
  if (options.length !== 4) {
    errors.push(`${where}: expected 4 options (or 5), found ${options.length}`);
    return null;
  }
  // Exact comparison: capitalisation questions differ only in letter case.
  const normalised = options.map((o) => o.replace(/\s+/g, " "));
  if (new Set(normalised).size !== 4) errors.push(`${where}: options are not all different`);
  if (!TOPICS.includes(raw.topic)) errors.push(`${where}: unknown topic "${raw.topic}"`);
  if (!raw.prompt && !raw.instruction) errors.push(`${where}: no prompt or instruction`);
  if (!raw.explanation) warnings.push(`${where}: no explanation`);
  if (!raw.source) errors.push(`${where}: no source`);

  const answerText = options[answerIndex];
  const choices = ordered ? options : shuffled(options, raw.prompt + options.join("|"));
  return {
    topic: raw.topic,
    instruction: raw.instruction ?? "",
    passage: raw.passage ?? "",
    prompt: raw.prompt ?? "",
    choices,
    answer: "ABCD"[choices.indexOf(answerText)],
    explanation: raw.explanation ?? "",
    tip: raw.tip ?? "",
    source: raw.source,
    mock: raw.mock ?? null,
  };
}

function parseFile(file) {
  const rel = path.relative(CONTENT, file);
  const lines = fs.readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/);
  const state = { topic: "", source: "", instruction: "", tip: "", mock: null, passage: "" };
  const items = [];
  let passageLines = null;
  lines.forEach((line, i) => {
    const where = `${rel}:${i + 1}`;
    if (passageLines) {
      if (line.trim() === "@end") {
        state.passage = passageLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
        passageLines = null;
      } else passageLines.push(line.trimEnd());
      return;
    }
    const t = line.trim();
    if (!t || t.startsWith("#")) return;
    if (t.startsWith("@")) {
      const [, key, rest = ""] = t.match(/^@(\w+)\s*(.*)$/) ?? [];
      switch (key) {
        case "topic": state.topic = rest; break;
        case "source": state.source = rest; break;
        case "instruction": state.instruction = rest; break;
        case "tip": state.tip = rest; break;
        case "mock": state.mock = rest || null; break;
        case "passage": passageLines = []; break;
        case "nopassage": state.passage = ""; break;
        default: errors.push(`${where}: unknown directive @${key}`);
      }
      return;
    }
    const [body, explanation = "", tip = ""] = t.split("||").map((s) => s.trim());
    const [prompt, ...options] = body.split("|").map((s) => s.trim());
    const q = finalise(
      { ...state, prompt, options, explanation, tip: tip || state.tip },
      where,
    );
    if (q) items.push({ ...q, where });
  });
  if (passageLines) errors.push(`${rel}: @passage without @end`);
  return items;
}

async function main() {
  const bankDir = path.join(CONTENT, "bank");
  const files = fs.readdirSync(bankDir).filter((f) => f.endsWith(".txt")).sort();
  let items = files.flatMap((f) => parseFile(path.join(bankDir, f)));

  const genDir = path.join(CONTENT, "generators");
  if (fs.existsSync(genDir)) {
    for (const f of fs.readdirSync(genDir).filter((f) => f.endsWith(".mjs")).sort()) {
      const mod = await import(pathToFileURL(path.join(genDir, f)).href);
      const generated = mod.default();
      generated.forEach((raw, i) => {
        const q = finalise(raw, `generators/${f}#${i + 1}`);
        if (q) items.push({ ...q, where: `generators/${f}#${i + 1}` });
      });
    }
  }

  // De-duplicate across all sources; mock papers keep a reference to the surviving copy.
  const seen = new Map();
  const questions = [];
  const mocks = JSON.parse(fs.readFileSync(path.join(CONTENT, "mocks.json"), "utf8"));
  const mockRefs = Object.fromEntries(mocks.map((m) => [m.key, []]));
  let duplicates = 0;
  for (const q of items) {
    const key = hash(
      `${q.prompt.toLowerCase().replace(/\W+/g, " ").trim()}|${[...q.choices].map((c) => c.trim()).sort().join("|")}|${q.passage.slice(0, 80)}`,
    );
    let ref = seen.get(key);
    if (ref) {
      duplicates++;
    } else {
      ref = `${q.topic.toLowerCase().replace(/\W+/g, "-")}-${key.slice(0, 10)}`;
      seen.set(key, ref);
      const { mock, where, ...rest } = q;
      questions.push({ ref, ...rest });
    }
    if (q.mock) {
      if (!mockRefs[q.mock]) errors.push(`${q.where}: unknown mock "${q.mock}"`);
      else mockRefs[q.mock].push(ref);
    }
  }

  // Report
  const byTopic = Object.fromEntries(TOPICS.map((t) => [t, 0]));
  const bySource = {};
  for (const q of questions) {
    byTopic[q.topic] = (byTopic[q.topic] ?? 0) + 1;
    bySource[q.source] = (bySource[q.source] ?? 0) + 1;
  }
  console.log(`\nQuestions: ${questions.length} (${duplicates} duplicates merged)`);
  console.table(byTopic);
  console.table(bySource);
  for (const m of mocks) console.log(`Mock "${m.title}": ${mockRefs[m.key].length} questions`);
  const letters = { A: 0, B: 0, C: 0, D: 0 };
  questions.forEach((q) => letters[q.answer]++);
  console.log("Answer letters:", letters);
  if (warnings.length) console.log(`\n${warnings.length} warning(s):\n  ${warnings.slice(0, 15).join("\n  ")}${warnings.length > 15 ? "\n  ..." : ""}`);
  if (errors.length) {
    console.error(`\n${errors.length} error(s):\n  ${errors.slice(0, 40).join("\n  ")}`);
    process.exit(1);
  }
  if (CHECK_ONLY) return;

  const body = {
    bank: {
      title: "EPTPREP Question Bank",
      description: "Every built-in question, for practice sets you build yourself: choose topics, number of questions and time.",
    },
    questions,
    mocks: mocks.map((m) => ({ title: m.title, description: m.description, minutes: m.minutes, refs: mockRefs[m.key] })),
  };
  const version = hash(JSON.stringify(body)).slice(0, 12);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ version, ...body }));
  console.log(`\nWrote ${path.relative(ROOT, OUT)} (version ${version}, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
}

await main();
