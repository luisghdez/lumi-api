export interface ReviewEvaluationCase {
  id: string;
  term: string;
  definition: string;
  transcript: string;
  currentScore: number;
  attemptNumber: number;
  expectedScore: { min: number; max: number };
  requiredFeedbackFragments?: string[];
}

type TermFixture = {
  id: string;
  term: string;
  definition: string;
  correct: string;
  partial: string;
  misconception: string;
};

// These are human-labelled assessment cases, not generated examples. Each term
// deliberately covers correct paraphrase, partial understanding, misconception,
// unrelated speech, an existing-score floor, third-attempt remediation, and a
// concise English-language-learner phrasing. Ten terms × eight cases = 80.
const terms: TermFixture[] = [
  {
    id: "homeostasis",
    term: "homeostasis",
    definition: "maintaining relatively stable internal conditions despite changes inside or outside an organism",
    correct: "Homeostasis is how an organism keeps internal conditions stable, like controlling body temperature even when the environment changes.",
    partial: "It means your body stays balanced and tries not to change too much.",
    misconception: "Homeostasis is when an animal stays in the same home all its life.",
  },
  {
    id: "photosynthesis",
    term: "photosynthesis",
    definition: "the process by which plants, algae, and some bacteria use light energy to make sugars from carbon dioxide and water, releasing oxygen",
    correct: "Photosynthesis uses sunlight, water, and carbon dioxide to make sugar for the plant and releases oxygen.",
    partial: "Plants use sunlight to make food.",
    misconception: "Photosynthesis is plants breathing in oxygen so they can make energy.",
  },
  {
    id: "natural-selection",
    term: "natural selection",
    definition: "the process in which heritable traits that improve survival or reproduction become more common in a population over generations",
    correct: "Natural selection means inherited traits that help organisms survive or reproduce get passed on more, so they become common over generations.",
    partial: "Animals with helpful traits survive better.",
    misconception: "Natural selection means animals decide to evolve the trait they need during their lifetime.",
  },
  {
    id: "opportunity-cost",
    term: "opportunity cost",
    definition: "the value of the next best alternative that is given up when a choice is made",
    correct: "Opportunity cost is the next best thing you give up when you choose something else, like the study time lost if I go to a movie.",
    partial: "It is what you lose when you spend money on something.",
    misconception: "Opportunity cost is the price printed on an item in a store.",
  },
  {
    id: "mitosis",
    term: "mitosis",
    definition: "cell division that produces two genetically identical daughter cells with the same chromosome number as the parent cell",
    correct: "Mitosis splits one cell into two genetically identical cells with the same number of chromosomes, which helps growth and repair.",
    partial: "Mitosis is when one cell divides into two cells.",
    misconception: "Mitosis makes sperm and egg cells with half as many chromosomes.",
  },
  {
    id: "correlation-causation",
    term: "correlation versus causation",
    definition: "correlation is an association between variables, while causation means a change in one variable directly produces a change in another",
    correct: "Correlation only says two things vary together. Causation means one directly causes the other, so correlation alone is not proof of cause.",
    partial: "Correlation means two things are related, and causation means one affects the other.",
    misconception: "If two things are correlated, one definitely causes the other.",
  },
  {
    id: "checks-balances",
    term: "checks and balances",
    definition: "a system that gives each branch of government powers to limit the powers of the other branches",
    correct: "Checks and balances lets each branch limit the others, such as a president vetoing a bill while Congress can override the veto.",
    partial: "The branches of government keep each other from having too much power.",
    misconception: "Checks and balances means every branch gets exactly the same amount of money.",
  },
  {
    id: "supply-demand",
    term: "supply and demand",
    definition: "the interaction between how much of a good producers will sell and how much consumers will buy, which helps determine market price and quantity",
    correct: "Supply is what producers offer and demand is what buyers want. Their interaction helps set the price and how much gets sold.",
    partial: "Supply is what a store has and demand is what people want.",
    misconception: "Supply and demand means a business can charge any price it wants forever.",
  },
  {
    id: "plate-tectonics",
    term: "plate tectonics",
    definition: "the theory that Earth's outer shell is divided into moving plates whose interactions cause earthquakes, volcanoes, mountain building, and seafloor spreading",
    correct: "Plate tectonics is the idea that Earth has moving outer plates, and where they interact can cause earthquakes, volcanoes, mountains, and new seafloor.",
    partial: "Earth's surface is made of plates that move.",
    misconception: "Plate tectonics means continents never move because they are fixed to the ocean floor.",
  },
  {
    id: "independent-variable",
    term: "independent variable",
    definition: "the factor deliberately changed by an investigator to test its effect on a dependent variable",
    correct: "The independent variable is what the scientist deliberately changes to see how it affects the dependent variable.",
    partial: "It is the variable the scientist changes in an experiment.",
    misconception: "The independent variable is the result that gets measured at the end of an experiment.",
  },
];

function casesFor(fixture: TermFixture): ReviewEvaluationCase[] {
  return [
    {
      id: `${fixture.id}-correct`, term: fixture.term, definition: fixture.definition,
      transcript: fixture.correct, currentScore: 0, attemptNumber: 1,
      expectedScore: { min: 90, max: 100 },
    },
    {
      id: `${fixture.id}-correct-ell`, term: fixture.term, definition: fixture.definition,
      transcript: `I think ${fixture.correct.replace(/\.$/, "").toLowerCase()}, yes?`, currentScore: 0, attemptNumber: 1,
      expectedScore: { min: 85, max: 100 },
    },
    {
      id: `${fixture.id}-partial`, term: fixture.term, definition: fixture.definition,
      transcript: fixture.partial, currentScore: 0, attemptNumber: 1,
      expectedScore: { min: 45, max: 80 },
    },
    {
      id: `${fixture.id}-minimal`, term: fixture.term, definition: fixture.definition,
      transcript: `It is something important about ${fixture.term}.`, currentScore: 0, attemptNumber: 1,
      expectedScore: { min: 0, max: 45 },
    },
    {
      id: `${fixture.id}-misconception`, term: fixture.term, definition: fixture.definition,
      transcript: fixture.misconception, currentScore: 0, attemptNumber: 1,
      expectedScore: { min: 0, max: 35 },
    },
    {
      id: `${fixture.id}-unrelated`, term: fixture.term, definition: fixture.definition,
      transcript: "I had cereal this morning and my bus was late.", currentScore: 0, attemptNumber: 1,
      expectedScore: { min: 0, max: 20 },
    },
    {
      id: `${fixture.id}-score-floor`, term: fixture.term, definition: fixture.definition,
      transcript: fixture.misconception, currentScore: 72, attemptNumber: 2,
      expectedScore: { min: 72, max: 100 },
    },
    {
      id: `${fixture.id}-third-attempt`, term: fixture.term, definition: fixture.definition,
      transcript: fixture.partial, currentScore: 0, attemptNumber: 3,
      expectedScore: { min: 45, max: 80 },
      requiredFeedbackFragments: [fixture.term.split(" ")[0]],
    },
  ];
}

export const REVIEW_EVALUATION_CASES = terms.flatMap(casesFor);
