import type { DatabaseSync } from "node:sqlite";
import { hashPassword } from "./password";

type Q = [prompt: string, a: string, b: string, c: string, d: string, answer: "A" | "B" | "C" | "D"];

type SeedTest = {
  section: string;
  title: string;
  description: string;
  level: string;
  kind: "official" | "practice";
  timeLimit?: number;
  questionLimit?: number;
  passage?: string;
  questions: Q[];
};

const SECTIONS: [string, string][] = [
  ["Grammar", "Tenses, articles, prepositions, conditionals and sentence structure."],
  ["Vocabulary", "Word meaning, collocations, synonyms and word formation."],
  ["Reading Comprehension", "Understanding main ideas, details and inference in passages."],
  ["Use of English", "Phrasal verbs, idioms and choosing the most natural expression."],
  ["Spelling & Punctuation", "Correct spelling, capitalisation and punctuation."],
];

const TESTS: SeedTest[] = [
  {
    section: "Grammar",
    title: "Grammar Proficiency Test 1",
    description: "A timed check of core B1 grammar. You have one attempt, so read each sentence carefully.",
    level: "B1",
    kind: "official",
    timeLimit: 15,
    questionLimit: 10,
    questions: [
      ["She ___ in London since 2019.", "lives", "is living", "has lived", "lived", "C"],
      ["If it ___ tomorrow, we will cancel the picnic.", "rains", "will rain", "rained", "would rain", "A"],
      ["I was reading when the phone ___.", "rang", "was ringing", "has rung", "rings", "A"],
      ["This is the ___ film I have ever seen.", "more interesting", "most interesting", "interestingest", "much interesting", "B"],
      ["He asked me where ___.", "did I live", "I lived", "do I live", "I am live", "B"],
      ["We have run out ___ milk.", "from", "with", "of", "off", "C"],
      ["You ___ wear a seatbelt. It's the law.", "might", "could", "must", "would", "C"],
      ["The letter ___ yesterday.", "was sent", "has sent", "sent", "is sending", "A"],
      ["I'm not used to ___ up so early.", "get", "getting", "got", "be getting", "B"],
      ["Neither Tom ___ Anna came to the party.", "or", "and", "nor", "but", "C"],
      ["By the time we arrived, the film ___.", "already started", "has already started", "had already started", "was already starting", "C"],
      ["There isn't ___ sugar left in the jar.", "many", "any", "some", "few", "B"],
    ],
  },
  {
    section: "Grammar",
    title: "Grammar Practice: Tenses",
    description: "Practise choosing the right tense. Retake as often as you like — questions are shuffled each time.",
    level: "B1",
    kind: "practice",
    questions: [
      ["Water ___ at 100 degrees Celsius.", "boil", "boils", "is boiling", "boiled", "B"],
      ["Look! The children ___ in the garden.", "play", "plays", "are playing", "have played", "C"],
      ["I ___ my keys. I can't find them anywhere.", "lost", "have lost", "was losing", "lose", "B"],
      ["When I was young, I ___ swim very well.", "can", "could", "am able", "may", "B"],
      ["This time next week, I ___ on a beach.", "lie", "will be lying", "am lying", "lay", "B"],
      ["They ___ for two hours when the rain started.", "walked", "were walking", "had been walking", "have walked", "C"],
      ["I ___ to Paris three times.", "went", "have been", "was going", "go", "B"],
      ["She usually ___ coffee in the morning.", "drinks", "is drinking", "drink", "drank", "A"],
      ["What ___ at 8 pm last night?", "did you do", "were you doing", "have you done", "do you do", "B"],
      ["By next June, I ___ here for ten years.", "will work", "will have worked", "work", "am working", "B"],
      ["He ___ the report before the meeting began.", "has finished", "finished", "had finished", "finishes", "C"],
      ["I promise I ___ you tomorrow.", "call", "will call", "am calling", "called", "B"],
    ],
  },
  {
    section: "Vocabulary",
    title: "Vocabulary Builder",
    description: "Everyday and academic vocabulary at B1 level. Choose your own time and number of questions.",
    level: "B1",
    kind: "practice",
    questions: [
      ["Choose the word closest in meaning to \"enormous\".", "tiny", "huge", "quick", "ancient", "B"],
      ["Choose the opposite of \"generous\".", "kind", "mean", "wealthy", "honest", "B"],
      ["I need to ___ a decision by Friday.", "do", "make", "take", "have", "B"],
      ["The meeting was ___ because the manager was ill.", "called off", "called up", "called in", "called for", "A"],
      ["She is very ___; she always tells the truth.", "honest", "jealous", "lazy", "careless", "A"],
      ["A person who writes books is an ___.", "editor", "author", "actor", "auditor", "B"],
      ["Which word means \"to make something better\"?", "worsen", "improve", "reduce", "ignore", "B"],
      ["The price of fuel has ___ sharply this year.", "risen", "raised", "arisen", "rised", "A"],
      ["He was ___ of the danger and kept walking.", "aware", "unaware", "awake", "afraid", "B"],
      ["Choose the correct noun form of \"decide\".", "decisive", "decidedly", "decision", "deciding", "C"],
      ["I can't ___ the noise any longer!", "stand", "sit", "hold", "carry", "A"],
      ["\"Reluctant\" most nearly means ___.", "eager", "unwilling", "confused", "tired", "B"],
    ],
  },
  {
    section: "Reading Comprehension",
    title: "Reading: The Rise of Remote Work",
    description: "Read the passage, then answer the questions. One attempt, timed.",
    level: "B1",
    kind: "official",
    timeLimit: 12,
    questionLimit: 6,
    passage: `Not long ago, working from home was a privilege enjoyed by only a few employees. Most people travelled to an office every day, and managers often believed that staff who could not be seen were not really working.

That attitude changed quickly when many companies were forced to close their offices. Almost overnight, millions of people set up desks in kitchens and spare bedrooms. To the surprise of many managers, productivity did not fall. In some teams it even rose, as employees saved hours that had previously been spent commuting.

Remote work is not perfect, however. Some workers say they feel isolated and miss the casual conversations that happen around the coffee machine. Others find it difficult to separate their working day from their family life, and end up working longer hours than before.

As a result, many organisations now offer a "hybrid" model, in which employees spend part of the week in the office and part at home. Supporters argue that this combines the focus of home working with the teamwork of the office. Whether it becomes the permanent standard remains to be seen.`,
    questions: [
      ["What is the main idea of the passage?", "Offices will soon disappear completely.", "Attitudes to working from home have changed, with benefits and drawbacks.", "Managers dislike hybrid working.", "Commuting is the biggest problem for workers.", "B"],
      ["According to the passage, what did many managers originally believe?", "Remote workers were more productive.", "Staff who could not be seen were not really working.", "Offices were too expensive.", "Employees preferred to work at home.", "B"],
      ["Why did productivity rise in some teams?", "Employees were paid more.", "Managers checked on staff more often.", "Employees saved time that they used to spend commuting.", "Offices were redesigned.", "C"],
      ["The word \"isolated\" in paragraph 3 is closest in meaning to ___.", "alone and cut off", "busy and stressed", "relaxed", "well paid", "A"],
      ["Which problem of remote work is mentioned?", "Poor internet connections", "Working longer hours than before", "Higher travel costs", "Lack of equipment", "B"],
      ["What does the writer say about the hybrid model in the final sentence?", "It has already failed.", "It is clearly the best option.", "It is not yet certain whether it will last.", "It is only suitable for managers.", "C"],
    ],
  },
  {
    section: "Spelling & Punctuation",
    title: "Spelling & Punctuation Check",
    description: "Spot the correctly written option. Great for warming up before an official test.",
    level: "B1",
    kind: "practice",
    questions: [
      ["Choose the correct spelling.", "recieve", "receive", "receeve", "riceive", "B"],
      ["Choose the correct spelling.", "definately", "definitly", "definitely", "defanitely", "C"],
      ["Choose the correct spelling.", "accommodation", "accomodation", "acommodation", "accommadation", "A"],
      ["Choose the correctly punctuated sentence.", "Its a lovely day.", "It's a lovely day.", "Its' a lovely day.", "It,s a lovely day.", "B"],
      ["Choose the correctly punctuated sentence.", "The dog wagged it's tail.", "The dog wagged its tail.", "The dog wagged its' tail.", "The dog wagged it is tail.", "B"],
      ["Choose the correct spelling.", "necessary", "neccessary", "necesary", "neccesary", "A"],
      ["Choose the correctly punctuated sentence.", "I bought apples, oranges, and pears.", "I bought apples oranges, and pears.", "I bought, apples oranges and pears.", "I bought apples; oranges and, pears.", "A"],
      ["Choose the correctly capitalised sentence.", "we visited paris in july.", "We visited Paris in July.", "We visited paris in July.", "We Visited Paris In July.", "B"],
      ["Choose the correct spelling.", "begining", "beggining", "beginning", "beginnig", "C"],
      ["Choose the correctly punctuated sentence.", "\"Where are you going?\" she asked.", "\"Where are you going\"? she asked.", "\"Where are you going.\" she asked?", "Where are you going? \"she asked.\"", "A"],
    ],
  },
];

export function seed(db: DatabaseSync) {
  db.exec("BEGIN");
  try {
    db.prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)").run("admin", hashPassword("admin123"));

    // Demo candidate for trying the app locally (see README).
    db.prepare(
      "INSERT INTO candidates (full_name, email, password_hash, gender, level, access) VALUES (?, ?, ?, ?, ?, 'both')",
    ).run("Demo Candidate", "demo@eptprep.test", hashPassword("demo1234"), "", "B1");

    const insSection = db.prepare("INSERT INTO sections (name, description) VALUES (?, ?)");
    const sectionIds = new Map<string, number>();
    for (const [name, description] of SECTIONS) {
      sectionIds.set(name, Number(insSection.run(name, description).lastInsertRowid));
    }

    const insTest = db.prepare(
      `INSERT INTO tests (section_id, title, description, level, kind, time_limit, question_limit, passage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insQuestion = db.prepare(
      "INSERT INTO questions (test_id, prompt, choice_a, choice_b, choice_c, choice_d, answer) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (const t of TESTS) {
      const testId = Number(
        insTest.run(
          sectionIds.get(t.section)!,
          t.title,
          t.description,
          t.level,
          t.kind,
          t.timeLimit ?? 0,
          t.questionLimit ?? 0,
          t.passage ?? "",
        ).lastInsertRowid,
      );
      for (const q of t.questions) insQuestion.run(testId, ...q);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
