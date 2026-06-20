/**
 * unitCatalog.ts
 *
 * Official College Board unit structures for every AP course Lumi supports.
 * Unit names and descriptions are sourced from the published Course and Exam
 * Descriptions (CEDs). This file contains NO lesson content — content is
 * generated separately by generateAPContent.ts and stored in generated/.
 *
 * apSubject values match the courseSubjects enum in openAICourseContentService.ts.
 * The "AP Calculus AB", "AP Calculus BC", and "AP Seminar" entries use custom
 * subject strings that should be added to that enum when ready.
 */

export interface CatalogUnit {
  unitNumber: number;
  unitName: string;
  description: string;
}

export interface CatalogExam {
  /** Must match the courseSubjects enum (or a planned addition to it). */
  apSubject: string;
  /** Kebab-case file slug, e.g. "ap-chemistry" → generated/ap-chemistry.json */
  slug: string;
  units: CatalogUnit[];
}

// Language theme units shared by all AP World Language & Culture courses
const WORLD_LANGUAGE_UNITS: CatalogUnit[] = [
  {
    unitNumber: 1,
    unitName: "Families and Communities",
    description:
      "Language and culture related to family structures, community life, social roles, and interpersonal relationships.",
  },
  {
    unitNumber: 2,
    unitName: "Personal and Public Identities",
    description:
      "Exploration of self-identity, cultural identity, national identity, and how they intersect in personal and public life.",
  },
  {
    unitNumber: 3,
    unitName: "Contemporary Life",
    description:
      "Everyday modern life including education, work, leisure, and social media across cultures.",
  },
  {
    unitNumber: 4,
    unitName: "Global Challenges",
    description:
      "Major global issues such as climate change, poverty, migration, public health, and human rights.",
  },
  {
    unitNumber: 5,
    unitName: "Science and Technology",
    description:
      "Impact of scientific advances and technology on society, communication, medicine, and the environment.",
  },
  {
    unitNumber: 6,
    unitName: "Beauty and Aesthetics",
    description:
      "Art, music, literature, architecture, and the cultural definition of beauty across different societies.",
  },
];

export const AP_CATALOG: CatalogExam[] = [
  // ─── Sciences ──────────────────────────────────────────────────────────────

  {
    apSubject: "AP Biology",
    slug: "ap-biology",
    units: [
      { unitNumber: 1, unitName: "Chemistry of Life", description: "Water properties, macromolecule structure, and how chemical properties of biological molecules support life." },
      { unitNumber: 2, unitName: "Cell Structure and Function", description: "Prokaryotic and eukaryotic cell structures, organelle functions, and membrane transport mechanisms." },
      { unitNumber: 3, unitName: "Cellular Energetics", description: "Enzyme function, photosynthesis (light and Calvin cycle), and cellular respiration (glycolysis, Krebs cycle, ETC)." },
      { unitNumber: 4, unitName: "Cell Communication and Cell Cycle", description: "Signal transduction pathways, cell-to-cell communication, mitosis, and cell cycle regulation." },
      { unitNumber: 5, unitName: "Heredity", description: "Meiosis, Mendelian genetics, non-Mendelian inheritance patterns, and the chromosomal basis of heredity." },
      { unitNumber: 6, unitName: "Gene Expression and Regulation", description: "DNA replication, transcription, translation, operons, and epigenetic regulation of gene expression." },
      { unitNumber: 7, unitName: "Natural Selection", description: "Mechanisms of evolution, natural selection, genetic drift, gene flow, speciation, and phylogenetics." },
      { unitNumber: 8, unitName: "Ecology", description: "Population ecology, community interactions, ecosystem energy flow, biogeochemical cycles, and global change." },
    ],
  },

  {
    apSubject: "AP Chemistry",
    slug: "ap-chemistry",
    units: [
      { unitNumber: 1, unitName: "Atomic Structure and Properties", description: "Moles, mass spectrometry, electron configuration, photoelectron spectroscopy, and periodic trends." },
      { unitNumber: 2, unitName: "Compound Structure and Properties", description: "Lewis structures, VSEPR, hybridization, bond types, and properties of ionic, covalent, and metallic compounds." },
      { unitNumber: 3, unitName: "Properties of Substances and Mixtures", description: "Intermolecular forces, solids, gases, solutions, spectroscopy, and chromatography." },
      { unitNumber: 4, unitName: "Chemical Reactions", description: "Types of chemical reactions, net ionic equations, stoichiometry, titrations, and electrochemical cells." },
      { unitNumber: 5, unitName: "Kinetics", description: "Reaction rates, rate laws, integrated rate laws, reaction mechanisms, and the effect of temperature on rate." },
      { unitNumber: 6, unitName: "Thermochemistry", description: "Endothermic and exothermic reactions, Hess's law, bond enthalpies, calorimetry, and Gibbs free energy basics." },
      { unitNumber: 7, unitName: "Equilibrium", description: "Dynamic equilibrium, equilibrium constant expressions (Kc, Kp), ICE tables, Le Châtelier's principle, and solubility equilibria." },
      { unitNumber: 8, unitName: "Acids and Bases", description: "Brønsted–Lowry acids/bases, pH, Ka and Kb, buffers, acid–base titrations, and indicators." },
      { unitNumber: 9, unitName: "Thermodynamics and Electrochemistry", description: "Entropy, Gibbs free energy, standard reduction potentials, Nernst equation, and electrolytic cells." },
    ],
  },

  {
    apSubject: "AP Environmental Science",
    slug: "ap-environmental-science",
    units: [
      { unitNumber: 1, unitName: "The Living World: Ecosystems", description: "Ecosystem structure, energy flow, food webs, biogeochemical cycles (carbon, nitrogen, phosphorus, water)." },
      { unitNumber: 2, unitName: "The Living World: Biodiversity", description: "Natural ecosystem services, biodiversity hotspots, island biogeography, and threats to biodiversity." },
      { unitNumber: 3, unitName: "Populations", description: "Population dynamics, carrying capacity, survivorship curves, age structure, and human population growth." },
      { unitNumber: 4, unitName: "Earth Systems and Resources", description: "Plate tectonics, soil formation, atmosphere layers, solar radiation, and Earth's water systems." },
      { unitNumber: 5, unitName: "Land and Water Use", description: "Agriculture, pest management, forestry, mining, fishing, and sustainable land and water practices." },
      { unitNumber: 6, unitName: "Energy Resources and Consumption", description: "Fossil fuels, nuclear energy, renewable energy sources, global energy consumption, and energy efficiency." },
      { unitNumber: 7, unitName: "Atmospheric Pollution", description: "Air pollutants, photochemical smog, acid deposition, stratospheric ozone depletion, and indoor air quality." },
      { unitNumber: 8, unitName: "Aquatic and Terrestrial Pollution", description: "Water pollution sources, thermal pollution, solid and hazardous waste, and pollution remediation strategies." },
      { unitNumber: 9, unitName: "Global Change", description: "Climate change drivers, global warming impacts, ocean acidification, loss of biodiversity, and environmental policy." },
    ],
  },

  {
    apSubject: "AP Physics 1",
    slug: "ap-physics-1",
    units: [
      { unitNumber: 1, unitName: "Kinematics", description: "Displacement, velocity, acceleration, kinematic equations, projectile motion, and graphical analysis of motion." },
      { unitNumber: 2, unitName: "Force and Translational Dynamics", description: "Newton's three laws, friction, normal force, tension, and free-body diagrams for translational equilibrium." },
      { unitNumber: 3, unitName: "Work, Energy, and Power", description: "Work-energy theorem, conservative forces, conservation of mechanical energy, and power calculations." },
      { unitNumber: 4, unitName: "Linear Momentum", description: "Impulse-momentum theorem, conservation of linear momentum, elastic and inelastic collisions." },
      { unitNumber: 5, unitName: "Torque and Rotational Dynamics", description: "Torque, rotational inertia, Newton's second law for rotation, and static equilibrium of rigid bodies." },
      { unitNumber: 6, unitName: "Energy and Momentum of Rotating Systems", description: "Rotational kinetic energy, angular momentum, and conservation laws applied to rotating systems." },
      { unitNumber: 7, unitName: "Oscillations", description: "Simple harmonic motion, period and frequency of springs and pendulums, energy in oscillating systems." },
      { unitNumber: 8, unitName: "Fluids", description: "Density, pressure, Archimedes' principle, buoyancy, fluid flow continuity, and Bernoulli's equation." },
    ],
  },

  {
    apSubject: "AP Physics 2",
    slug: "ap-physics-2",
    units: [
      { unitNumber: 1, unitName: "Fluids", description: "Fluid statics and dynamics: pressure, buoyancy, continuity equation, and Bernoulli's principle in depth." },
      { unitNumber: 2, unitName: "Thermodynamics", description: "Ideal gas law, kinetic theory, first and second laws of thermodynamics, heat engines, and entropy." },
      { unitNumber: 3, unitName: "Electric Force, Field, and Potential", description: "Coulomb's law, electric field lines, Gauss's law, electric potential energy, and equipotential surfaces." },
      { unitNumber: 4, unitName: "Electric Circuits", description: "Current, resistance, Ohm's law, Kirchhoff's rules, series and parallel circuits, capacitors, and RC circuits." },
      { unitNumber: 5, unitName: "Magnetism and Electromagnetic Induction", description: "Magnetic force, magnetic fields, Biot–Savart law, Faraday's law, Lenz's law, and inductors." },
      { unitNumber: 6, unitName: "Geometric and Physical Optics", description: "Reflection, refraction, Snell's law, lenses, mirrors, diffraction, interference, and the double-slit experiment." },
      { unitNumber: 7, unitName: "Quantum, Atomic, and Nuclear Physics", description: "Photoelectric effect, de Broglie wavelength, atomic models, nuclear reactions, radioactive decay, and mass-energy equivalence." },
    ],
  },

  {
    apSubject: "AP Physics C: Mechanics",
    slug: "ap-physics-c-mechanics",
    units: [
      { unitNumber: 1, unitName: "Kinematics", description: "Calculus-based kinematics: position, velocity, acceleration as derivatives/integrals; projectile and circular motion." },
      { unitNumber: 2, unitName: "Newton's Laws of Motion", description: "Newton's three laws using calculus, variable forces, friction, and constraint problems with multiple bodies." },
      { unitNumber: 3, unitName: "Work, Energy, and Power", description: "Work as a line integral, kinetic and potential energy, conservation of energy, and power for variable forces." },
      { unitNumber: 4, unitName: "Systems of Particles and Linear Momentum", description: "Center of mass, impulse-momentum theorem with calculus, elastic and inelastic collisions, and variable-mass systems." },
      { unitNumber: 5, unitName: "Rotation, Oscillations, and Gravitation", description: "Rotational dynamics (torque, angular momentum, moment of inertia), simple harmonic motion, and gravitational law." },
    ],
  },

  {
    apSubject: "AP Physics C: E&M",
    slug: "ap-physics-c-em",
    units: [
      { unitNumber: 1, unitName: "Electrostatics", description: "Coulomb's law, electric field using calculus and Gauss's law, electric potential, and energy in electric fields." },
      { unitNumber: 2, unitName: "Conductors, Capacitors, and Dielectrics", description: "Properties of conductors, capacitance, energy stored in capacitors, and effect of dielectric materials." },
      { unitNumber: 3, unitName: "Electric Circuits", description: "Current, resistance, EMF, Kirchhoff's laws, RC circuits, and transient analysis." },
      { unitNumber: 4, unitName: "Magnetic Fields", description: "Magnetic force on charges and currents, Biot–Savart law, Ampere's law, and magnetic fields of common geometries." },
      { unitNumber: 5, unitName: "Electromagnetism", description: "Faraday's law, Lenz's law, mutual and self-inductance, RL circuits, and Maxwell's equations overview." },
    ],
  },

  // ─── Mathematics ───────────────────────────────────────────────────────────

  {
    apSubject: "AP Calculus AB",
    slug: "ap-calculus-ab",
    units: [
      { unitNumber: 1, unitName: "Limits and Continuity", description: "Limit definition, limit laws, squeeze theorem, continuity, and limits at infinity." },
      { unitNumber: 2, unitName: "Differentiation: Definition and Fundamental Properties", description: "Derivative definition, basic differentiation rules, product and quotient rules." },
      { unitNumber: 3, unitName: "Differentiation: Composite, Implicit, and Inverse Functions", description: "Chain rule, implicit differentiation, and derivatives of inverse functions including trig inverses." },
      { unitNumber: 4, unitName: "Contextual Applications of Differentiation", description: "Rates of change in motion, related rates, and linear approximation (tangent line approximation)." },
      { unitNumber: 5, unitName: "Analytical Applications of Differentiation", description: "Mean Value Theorem, extreme values, critical points, concavity, inflection points, and curve sketching." },
      { unitNumber: 6, unitName: "Integration and Accumulation of Change", description: "Riemann sums, definite integrals, Fundamental Theorem of Calculus, antiderivatives, and substitution." },
      { unitNumber: 7, unitName: "Differential Equations", description: "Differential equations, separation of variables, slope fields, and exponential growth/decay models." },
      { unitNumber: 8, unitName: "Applications of Integration", description: "Average value, area between curves, volume of solids (disc and washer methods), and accumulation problems." },
    ],
  },

  {
    apSubject: "AP Calculus BC",
    slug: "ap-calculus-bc",
    units: [
      { unitNumber: 1, unitName: "Limits and Continuity", description: "Limit definition, L'Hôpital's rule, continuity, and limits involving indeterminate forms." },
      { unitNumber: 2, unitName: "Differentiation: Definition and Fundamental Properties", description: "Derivative definition, differentiation rules, and applications to linear approximation." },
      { unitNumber: 3, unitName: "Differentiation: Composite, Implicit, and Inverse Functions", description: "Chain rule, implicit differentiation, and inverse function derivatives." },
      { unitNumber: 4, unitName: "Contextual Applications of Differentiation", description: "Rates of change, related rates, and motion analysis." },
      { unitNumber: 5, unitName: "Analytical Applications of Differentiation", description: "Mean Value Theorem, curve analysis, extreme values, concavity, and optimization." },
      { unitNumber: 6, unitName: "Integration and Accumulation of Change", description: "Riemann sums, FTC, antiderivatives, integration by parts, partial fractions, and improper integrals." },
      { unitNumber: 7, unitName: "Differential Equations", description: "Separation of variables, slope fields, Euler's method, and logistic growth models." },
      { unitNumber: 8, unitName: "Applications of Integration", description: "Area between curves, volume, arc length, and motion problems." },
      { unitNumber: 9, unitName: "Parametric Equations, Polar Coordinates, and Vector-Valued Functions", description: "Derivatives and integrals of parametric and vector functions; polar area and arc length." },
      { unitNumber: 10, unitName: "Infinite Sequences and Series", description: "Convergence tests, Taylor and Maclaurin series, power series, radius of convergence, and error bounds." },
    ],
  },

  {
    apSubject: "AP Statistics",
    slug: "ap-statistics",
    units: [
      { unitNumber: 1, unitName: "Exploring One-Variable Data", description: "Distributions, summary statistics (mean, median, SD, IQR), graphical displays, and Normal distributions." },
      { unitNumber: 2, unitName: "Exploring Two-Variable Data", description: "Scatterplots, correlation, least-squares regression, residuals, and influential points." },
      { unitNumber: 3, unitName: "Collecting Data", description: "Survey design, sampling methods, experimental design, randomization, and sources of bias." },
      { unitNumber: 4, unitName: "Probability, Random Variables, and Probability Distributions", description: "Probability rules, conditional probability, binomial and geometric distributions, and expected value." },
      { unitNumber: 5, unitName: "Sampling Distributions", description: "Central Limit Theorem, sampling distribution of the sample mean and proportion, and standard error." },
      { unitNumber: 6, unitName: "Inference for Categorical Data: Proportions", description: "Confidence intervals and significance tests for one and two proportions; Type I and II errors." },
      { unitNumber: 7, unitName: "Inference for Quantitative Data: Means", description: "t-distributions, confidence intervals, and hypothesis tests for one sample mean and two means." },
      { unitNumber: 8, unitName: "Inference for Categorical Data: Chi-Square", description: "Chi-square goodness of fit, homogeneity, and independence tests; expected counts." },
      { unitNumber: 9, unitName: "Inference for Quantitative Data: Slopes", description: "Inference for slope of regression line, confidence intervals, and t-test for slope." },
    ],
  },

  {
    apSubject: "AP Pre-Calculus",
    slug: "ap-precalculus",
    units: [
      { unitNumber: 1, unitName: "Polynomial and Rational Functions", description: "Polynomial behavior, zeros, end behavior, rational functions, asymptotes, and function composition." },
      { unitNumber: 2, unitName: "Exponential and Logarithmic Functions", description: "Exponential growth and decay, properties of logarithms, solving exponential and logarithmic equations." },
      { unitNumber: 3, unitName: "Trigonometric and Polar Functions", description: "Unit circle, trigonometric functions, inverses, graphs, identities, and introduction to polar coordinates." },
      { unitNumber: 4, unitName: "Functions Involving Parameters, Vectors, and Matrices", description: "Parametric functions, vectors in 2D, matrix operations, and systems of equations." },
    ],
  },

  // ─── Computer Science ──────────────────────────────────────────────────────

  {
    apSubject: "AP Computer Science A",
    slug: "ap-computer-science-a",
    units: [
      { unitNumber: 1, unitName: "Primitive Types", description: "Data types (int, double, boolean), variables, arithmetic operators, and basic Java syntax." },
      { unitNumber: 2, unitName: "Using Objects", description: "Objects and classes, method calls, String methods, Math class, and the wrapper classes Integer and Double." },
      { unitNumber: 3, unitName: "Boolean Expressions and if Statements", description: "Boolean expressions, relational and logical operators, if/else-if/else chains, and nested conditionals." },
      { unitNumber: 4, unitName: "Iteration", description: "While loops, for loops, do-while loops, nested loops, and the String traversal pattern." },
      { unitNumber: 5, unitName: "Writing Classes", description: "Class structure, instance variables, constructors, accessor and mutator methods, and static vs. instance." },
      { unitNumber: 6, unitName: "Array", description: "1D arrays, array traversal, algorithms (search, sort, min/max), and off-by-one errors." },
      { unitNumber: 7, unitName: "ArrayList", description: "ArrayList class, add/remove/get/set methods, traversal with iterators and enhanced for loops." },
      { unitNumber: 8, unitName: "2D Array", description: "2D arrays, row-major traversal, column traversal, and algorithms on 2D array data." },
      { unitNumber: 9, unitName: "Inheritance", description: "Superclasses and subclasses, the extends keyword, method overriding, polymorphism, and abstract classes." },
      { unitNumber: 10, unitName: "Recursion", description: "Recursive methods, base cases, recursive calls, and tracing recursive algorithms." },
    ],
  },

  {
    apSubject: "AP Computer Science Principles",
    slug: "ap-computer-science-principles",
    units: [
      { unitNumber: 1, unitName: "Digital Information", description: "Binary representation, data compression, images, sound, and the limits of digital representation." },
      { unitNumber: 2, unitName: "The Internet", description: "How the Internet works: protocols, IP addresses, DNS, packet routing, HTTP, and cybersecurity." },
      { unitNumber: 3, unitName: "Programming", description: "Variables, data types, conditionals, loops, functions, lists, and algorithm design in pseudocode." },
      { unitNumber: 4, unitName: "Data Analysis", description: "Collecting, cleaning, and visualizing data; identifying patterns; limitations of data and metadata." },
      { unitNumber: 5, unitName: "Impacts of Computing", description: "Digital divide, intellectual property, privacy, algorithmic bias, and beneficial/harmful effects of computing." },
    ],
  },

  // ─── Social Sciences ───────────────────────────────────────────────────────

  {
    apSubject: "AP Psychology",
    slug: "ap-psychology",
    units: [
      { unitNumber: 1, unitName: "Biological Bases of Behavior", description: "Nervous system structure, brain regions and functions, neurotransmitters, genetics, and evolutionary psychology." },
      { unitNumber: 2, unitName: "Cognition", description: "Perception, attention, memory models (encoding/storage/retrieval), forgetting, thinking, language, and problem-solving." },
      { unitNumber: 3, unitName: "Development and Learning", description: "Lifespan development, classical and operant conditioning, observational learning, and cognitive development." },
      { unitNumber: 4, unitName: "Social Psychology and Personality", description: "Social influence, conformity, obedience, attitudes, trait and psychodynamic personality theories." },
      { unitNumber: 5, unitName: "Mental and Physical Health", description: "Psychological disorders (classification, symptoms), treatment approaches, stress, coping, and health psychology." },
    ],
  },

  {
    apSubject: "AP US Government & Politics",
    slug: "ap-us-government",
    units: [
      { unitNumber: 1, unitName: "Foundations of American Democracy", description: "Constitutional principles, Articles of Confederation, Federalist Papers, checks and balances, and federalism." },
      { unitNumber: 2, unitName: "Interactions Among Branches of Government", description: "Legislative process, executive power, judicial review, bureaucracy, and inter-branch conflicts." },
      { unitNumber: 3, unitName: "Civil Liberties and Civil Rights", description: "Bill of Rights, incorporation doctrine, landmark civil rights legislation, and equal protection analysis." },
      { unitNumber: 4, unitName: "American Political Ideologies and Beliefs", description: "Political socialization, polling, ideological spectrum, and linkage institutions." },
      { unitNumber: 5, unitName: "Political Participation", description: "Voting, elections, political parties, interest groups, media, and campaign finance." },
    ],
  },

  {
    apSubject: "AP Comparative Government & Politics",
    slug: "ap-comparative-government",
    units: [
      { unitNumber: 1, unitName: "Political Systems, Regimes, and Governments", description: "Regime types, democratic vs. authoritarian systems, legitimacy, sovereignty, and country comparisons." },
      { unitNumber: 2, unitName: "Political Institutions", description: "Legislatures, executives, judiciaries, and bureaucracies across the six AP countries (UK, Russia, China, Iran, Mexico, Nigeria)." },
      { unitNumber: 3, unitName: "Political Culture and Participation", description: "Civil society, political culture, interest groups, social movements, and citizen participation across regimes." },
      { unitNumber: 4, unitName: "Party and Electoral Systems and Citizen Organizations", description: "Electoral systems (proportional, majoritarian), party systems, and organized civil society." },
      { unitNumber: 5, unitName: "Political and Economic Changes and Development", description: "Democratization, authoritarianism, economic liberalization, globalization, and political change." },
    ],
  },

  {
    apSubject: "AP Microeconomics",
    slug: "ap-microeconomics",
    units: [
      { unitNumber: 1, unitName: "Basic Economic Concepts", description: "Scarcity, opportunity cost, trade-offs, production possibilities, gains from trade, and economic systems." },
      { unitNumber: 2, unitName: "Supply and Demand", description: "Law of supply and demand, market equilibrium, price controls, consumer and producer surplus, and elasticity." },
      { unitNumber: 3, unitName: "Production, Cost, and the Perfect Competition Model", description: "Production function, short- and long-run costs, profit maximization, and competitive markets." },
      { unitNumber: 4, unitName: "Imperfect Competition", description: "Monopoly, oligopoly, monopolistic competition, price discrimination, and market power." },
      { unitNumber: 5, unitName: "Factor Markets and Market Failure", description: "Labor market, derived demand, wages, externalities, public goods, market failures, and government intervention." },
    ],
  },

  {
    apSubject: "AP Macroeconomics",
    slug: "ap-macroeconomics",
    units: [
      { unitNumber: 1, unitName: "Basic Economic Concepts", description: "Scarcity, production possibilities, comparative advantage, trade, and economic systems overview." },
      { unitNumber: 2, unitName: "Economic Indicators and the Business Cycle", description: "GDP measurement, business cycle phases, unemployment types, inflation, price indices, and CPI vs. GDP deflator." },
      { unitNumber: 3, unitName: "National Income and Price Determination", description: "Aggregate demand and supply, multiplier effect, fiscal policy, automatic stabilizers, and recessionary/inflationary gaps." },
      { unitNumber: 4, unitName: "Financial Sector", description: "Money supply, money creation, Federal Reserve, monetary policy tools, and money market/loanable funds models." },
      { unitNumber: 5, unitName: "Long-Run Consequences of Stabilization Policies", description: "Phillips curve, short- vs. long-run aggregate supply, crowding out, and alternative macroeconomic views." },
      { unitNumber: 6, unitName: "Open Economy: International Trade and Finance", description: "Balance of payments, current and capital accounts, exchange rates, and trade deficits/surpluses." },
    ],
  },

  // ─── History ───────────────────────────────────────────────────────────────

  {
    apSubject: "AP US History",
    slug: "ap-us-history",
    units: [
      { unitNumber: 1, unitName: "Period 1: 1491–1607", description: "Pre-Columbian America, European exploration, Columbian Exchange, and early contact between Native Americans and Europeans." },
      { unitNumber: 2, unitName: "Period 2: 1607–1754", description: "Colonial settlement, transatlantic trade, slavery in British North America, and colonial conflicts." },
      { unitNumber: 3, unitName: "Period 3: 1754–1800", description: "Seven Years' War, American Revolution, Articles of Confederation, Constitutional Convention, and early republic." },
      { unitNumber: 4, unitName: "Period 4: 1800–1848", description: "Market revolution, Jacksonian democracy, westward expansion, reform movements, and antebellum society." },
      { unitNumber: 5, unitName: "Period 5: 1844–1877", description: "Manifest destiny, Civil War causes, the war itself, Reconstruction, and the 13th–15th Amendments." },
      { unitNumber: 6, unitName: "Period 6: 1865–1898", description: "Industrialization, Gilded Age, Populism, immigration, urbanization, and the New South." },
      { unitNumber: 7, unitName: "Period 7: 1890–1945", description: "Progressivism, imperialism, World War I, Roaring Twenties, Great Depression, New Deal, and World War II." },
      { unitNumber: 8, unitName: "Period 8: 1945–1980", description: "Cold War, Korean War, civil rights movement, Great Society, Vietnam War, and social/political upheaval." },
      { unitNumber: 9, unitName: "Period 9: 1980–Present", description: "Reagan Revolution, end of Cold War, globalization, 9/11, culture wars, and contemporary America." },
    ],
  },

  {
    apSubject: "AP European History",
    slug: "ap-european-history",
    units: [
      { unitNumber: 1, unitName: "Renaissance and Exploration (c.1450–c.1648)", description: "Italian Renaissance, humanism, printing press, Age of Exploration, and commercial revolution." },
      { unitNumber: 2, unitName: "Age of Reformation (c.1450–c.1648)", description: "Protestant Reformation, Counter-Reformation, religious wars, and the Peace of Westphalia." },
      { unitNumber: 3, unitName: "Absolutism and Constitutionalism (c.1648–c.1815)", description: "Louis XIV, absolute monarchies, constitutional governments, and the English Civil War and Glorious Revolution." },
      { unitNumber: 4, unitName: "Scientific, Philosophical, and Political Developments (c.1648–c.1815)", description: "Scientific Revolution, Enlightenment thinkers, and social contract theory." },
      { unitNumber: 5, unitName: "Conflict, Crisis, and Reaction in the Late 18th Century", description: "French Revolution causes, phases, and Napoleon Bonaparte's rise and fall." },
      { unitNumber: 6, unitName: "Industrialization and Its Effects (c.1815–c.1914)", description: "Industrial Revolution origins, capitalism, socialism, Marxism, and working-class conditions." },
      { unitNumber: 7, unitName: "19th-Century Perspectives and Political Developments (c.1815–c.1914)", description: "Nationalism, German and Italian unification, Revolutions of 1848, and imperialism." },
      { unitNumber: 8, unitName: "20th-Century Global Conflicts (c.1914–present)", description: "World War I causes and outcomes, Russian Revolution, Great Depression, fascism, and World War II." },
      { unitNumber: 9, unitName: "Cold War and Contemporary Europe (c.1914–present)", description: "Cold War in Europe, decolonization, European integration (EU), fall of the Berlin Wall, and contemporary challenges." },
    ],
  },

  {
    apSubject: "AP World History",
    slug: "ap-world-history",
    units: [
      { unitNumber: 1, unitName: "The Global Tapestry (c.1200–c.1450)", description: "Song China, Islamic caliphates, Byzantine Empire, African kingdoms, and the Americas before 1450." },
      { unitNumber: 2, unitName: "Networks of Exchange (c.1200–c.1450)", description: "Silk Roads, Indian Ocean trade, trans-Saharan trade, Mongol Empire, and the Black Death." },
      { unitNumber: 3, unitName: "Land-Based Empires (c.1450–c.1750)", description: "Ottoman, Safavid, Mughal, Ming/Qing, and Russian Empires — expansion, consolidation, and administration." },
      { unitNumber: 4, unitName: "Transoceanic Interconnections (c.1450–c.1750)", description: "European exploration, Columbian Exchange, Atlantic slave trade, and global economic integration." },
      { unitNumber: 5, unitName: "Revolutions (c.1750–c.1900)", description: "Enlightenment ideas, American and French Revolutions, Haitian Revolution, and Latin American independence movements." },
      { unitNumber: 6, unitName: "Consequences of Industrialization (c.1750–c.1900)", description: "Industrial Revolution's global spread, imperialism, resistance, and social changes." },
      { unitNumber: 7, unitName: "Global Conflict (c.1900–present)", description: "Causes and consequences of World War I and World War II; genocide and total war." },
      { unitNumber: 8, unitName: "Cold War and Decolonization (c.1900–present)", description: "Cold War ideological conflict, proxy wars, decolonization in Africa/Asia, and newly independent nations." },
      { unitNumber: 9, unitName: "Globalization (c.1900–present)", description: "Economic globalization, international organizations, technological change, and environmental and cultural impacts." },
    ],
  },

  {
    apSubject: "AP Human Geography",
    slug: "ap-human-geography",
    units: [
      { unitNumber: 1, unitName: "Thinking Geographically", description: "Geographic perspectives, maps, spatial data, scale, and geographic concepts of place, region, and diffusion." },
      { unitNumber: 2, unitName: "Population and Migration Patterns and Processes", description: "Population distribution, demographic transition model, migration push/pull factors, and refugee patterns." },
      { unitNumber: 3, unitName: "Cultural Patterns and Processes", description: "Cultural landscapes, language and religion diffusion, cultural hearths, and globalization vs. cultural identity." },
      { unitNumber: 4, unitName: "Political Patterns and Processes", description: "Political geography, boundaries, supranationalism, devolution, and territorial disputes." },
      { unitNumber: 5, unitName: "Agriculture and Rural Land-Use Patterns and Processes", description: "Agricultural origins, farming systems, von Thünen model, the Green Revolution, and sustainable agriculture." },
      { unitNumber: 6, unitName: "Cities and Urban Land-Use Patterns and Processes", description: "Urbanization, urban models (concentric zone, sector), suburbanization, gentrification, and global cities." },
      { unitNumber: 7, unitName: "Industrial and Economic Development Patterns and Processes", description: "Industrialization, Weber's least-cost theory, development indicators, globalization, and economic inequality." },
    ],
  },

  {
    apSubject: "AP African American Studies",
    slug: "ap-african-american-studies",
    units: [
      { unitNumber: 1, unitName: "Origins of the African Diaspora", description: "Africa before European contact, transatlantic slave trade, Middle Passage, and the formation of the African diaspora." },
      { unitNumber: 2, unitName: "Freedom, Enslavement, and Resistance", description: "Slavery in the Americas, forms of resistance, abolitionism, and the road to emancipation." },
      { unitNumber: 3, unitName: "The Practice of Freedom", description: "Reconstruction, Jim Crow, the Great Migration, Harlem Renaissance, and the NAACP." },
      { unitNumber: 4, unitName: "Movements and Debates", description: "Civil rights movement, Black Power, intersectionality, contemporary racial justice debates, and African American intellectual traditions." },
    ],
  },

  // ─── English ───────────────────────────────────────────────────────────────

  {
    apSubject: "AP English Literature",
    slug: "ap-english-literature",
    units: [
      { unitNumber: 1, unitName: "Short Fiction I", description: "Analyzing character, setting, and plot in short fiction; identifying narrative perspective and tone." },
      { unitNumber: 2, unitName: "Poetry I", description: "Reading lyric poetry, identifying figurative language, imagery, and tone to interpret meaning." },
      { unitNumber: 3, unitName: "Longer Fiction or Drama I", description: "Analyzing structure, character development, and theme in novels or plays." },
      { unitNumber: 4, unitName: "Short Fiction II", description: "Deeper analysis of literary techniques: symbol, irony, and subtext in short fiction." },
      { unitNumber: 5, unitName: "Poetry II", description: "Form, meter, sound devices, and complex figurative language in poetry analysis." },
      { unitNumber: 6, unitName: "Longer Fiction or Drama II", description: "Sophisticated analysis of narrative techniques, social context, and authorial choices in longer works." },
      { unitNumber: 7, unitName: "Short Fiction III", description: "Advanced interpretive skills applied to contemporary and global short fiction." },
      { unitNumber: 8, unitName: "Poetry III and Exam Preparation", description: "Complex poetry analysis, synthesis of literary arguments, and preparation for AP exam essay writing." },
    ],
  },

  {
    apSubject: "AP English Language",
    slug: "ap-english-language",
    units: [
      { unitNumber: 1, unitName: "Rhetorical Situation", description: "Speaker, occasion, audience, purpose, subject, and tone (SOAPSTone); analyzing how context shapes meaning." },
      { unitNumber: 2, unitName: "Claims and Evidence in Argument", description: "Types of claims, use of evidence, source credibility, and structuring arguments." },
      { unitNumber: 3, unitName: "Reasoning and Organization", description: "Logical reasoning structures, refutation, concession, arrangement, and line of reasoning." },
      { unitNumber: 4, unitName: "Style", description: "Diction, syntax, figurative language, tone, and how stylistic choices create rhetorical effect." },
      { unitNumber: 5, unitName: "Exam Preparation: Synthesis, Rhetoric, and Argument", description: "Writing synthesis, rhetorical analysis, and argument essays; integrating sources and citing evidence." },
    ],
  },

  // ─── Arts ──────────────────────────────────────────────────────────────────

  {
    apSubject: "AP Music Theory",
    slug: "ap-music-theory",
    units: [
      { unitNumber: 1, unitName: "Music Fundamentals: Pitch and Rhythm", description: "Clefs, note reading, accidentals, rhythm, meter, beat, and time signatures." },
      { unitNumber: 2, unitName: "Scales, Keys, and Modes", description: "Major and minor scales, key signatures, modes (Dorian, Phrygian, etc.), and scale degree names." },
      { unitNumber: 3, unitName: "Intervals and Chords", description: "Interval identification and inversion, triads (major, minor, diminished, augmented), and seventh chords." },
      { unitNumber: 4, unitName: "Harmony and Voice Leading I", description: "Figured bass, part writing rules, soprano-bass counterpoint, and diatonic chord progressions." },
      { unitNumber: 5, unitName: "Harmony and Voice Leading II: Diatonic and Tonicization", description: "Secondary dominants, tonicization, and more complex diatonic harmony." },
      { unitNumber: 6, unitName: "Harmony and Voice Leading III: Chromaticism", description: "Borrowed chords, Neapolitan sixth, augmented sixth chords (Italian, French, German), and chromatic voice leading." },
      { unitNumber: 7, unitName: "Musical Form", description: "Binary, ternary, rounded binary, rondo, sonata form, and motivic development." },
      { unitNumber: 8, unitName: "Post-Tonal Music and Composition", description: "20th-century techniques: modes, whole-tone scales, serialism, and writing original melodies and harmonizations." },
    ],
  },

  {
    apSubject: "AP Art History",
    slug: "ap-art-history",
    units: [
      { unitNumber: 1, unitName: "Global Prehistory (30,000–500 BCE)", description: "Paleolithic cave paintings, Neolithic monuments (Stonehenge), and early human artistic expression." },
      { unitNumber: 2, unitName: "Ancient Mediterranean (3500–30 BCE)", description: "Ancient Egypt, Mesopotamia, Greece (Archaic, Classical, Hellenistic), and Rome." },
      { unitNumber: 3, unitName: "Early Europe and Colonial Americas (200–1750 CE)", description: "Early Christian, Byzantine, Islamic, Romanesque, Gothic, Renaissance, and Baroque art." },
      { unitNumber: 4, unitName: "Later Europe and Americas (1750–1980 CE)", description: "Neoclassicism, Romanticism, Realism, Impressionism, Post-Impressionism, Modernism, and contemporary movements." },
      { unitNumber: 5, unitName: "Indigenous Americas (1000 BCE–1980 CE)", description: "Mesoamerican (Maya, Aztec), Andean (Inca), and North American Indigenous art traditions." },
      { unitNumber: 6, unitName: "Africa (1100–1980 CE)", description: "Sub-Saharan African art traditions, including Yoruba, Kongo, Great Zimbabwe, and Benin bronzes." },
      { unitNumber: 7, unitName: "West and Central Asia (500 BCE–1980 CE)", description: "Persian Empire, Islamic art and architecture, and Central Asian artistic traditions." },
      { unitNumber: 8, unitName: "South, East, and Southeast Asia (300 BCE–1980 CE)", description: "Hindu, Buddhist, and Jain art; Chinese, Japanese, and Southeast Asian visual traditions." },
      { unitNumber: 9, unitName: "The Pacific (700–1980 CE)", description: "Oceanic art from Polynesia, Melanesia, Micronesia, and Australia, including monumental and portable forms." },
      { unitNumber: 10, unitName: "Global Contemporary (1980 CE–Present)", description: "Postmodern and contemporary global art practices, identity politics, digital art, and installation." },
    ],
  },

  // ─── Capstone ──────────────────────────────────────────────────────────────

  {
    apSubject: "AP Seminar",
    slug: "ap-seminar",
    units: [
      { unitNumber: 1, unitName: "Questioning and Exploring", description: "Developing inquiry questions, exploring diverse perspectives, and understanding the dimensions of a complex problem." },
      { unitNumber: 2, unitName: "Understanding and Analyzing Arguments", description: "Identifying claims, evidence, and reasoning; evaluating the logic and credibility of arguments." },
      { unitNumber: 3, unitName: "Evaluating Sources and Evidence", description: "Source credibility, bias, relevance, and synthesizing multiple sources to support a line of reasoning." },
      { unitNumber: 4, unitName: "Synthesizing and Presenting Arguments", description: "Structuring evidence-based arguments, presenting orally, and responding to counterarguments." },
    ],
  },

  // ─── Languages ─────────────────────────────────────────────────────────────

  {
    apSubject: "AP Spanish Language",
    slug: "ap-spanish-language",
    units: WORLD_LANGUAGE_UNITS,
  },

  {
    apSubject: "AP Spanish Literature",
    slug: "ap-spanish-literature",
    units: [
      { unitNumber: 1, unitName: "La narrativa: el siglo XX (20th-Century Narrative)", description: "Key themes, narrative techniques, and major authors of 20th-century Spanish and Latin American prose." },
      { unitNumber: 2, unitName: "La poesía: del siglo XV al XX (Poetry: 15th–20th Century)", description: "Poetic movements (Baroque, Romanticism, Modernismo, Generation of '27) and key poets." },
      { unitNumber: 3, unitName: "El teatro (Theater)", description: "Major Spanish-language plays, dramatic conventions, and thematic analysis." },
      { unitNumber: 4, unitName: "Identidades y sociedades (Identities and Societies)", description: "Intersections of identity, gender, race, and power in AP required texts." },
      { unitNumber: 5, unitName: "El ensayo y la escritura crítica (Essay and Critical Writing)", description: "Analytical essay skills, citing textual evidence, and comparative analysis across required works." },
    ],
  },

  {
    apSubject: "AP French",
    slug: "ap-french",
    units: WORLD_LANGUAGE_UNITS,
  },

  {
    apSubject: "AP German",
    slug: "ap-german",
    units: WORLD_LANGUAGE_UNITS,
  },

  {
    apSubject: "AP Italian",
    slug: "ap-italian",
    units: WORLD_LANGUAGE_UNITS,
  },

  {
    apSubject: "AP Chinese",
    slug: "ap-chinese",
    units: WORLD_LANGUAGE_UNITS,
  },

  {
    apSubject: "AP Japanese",
    slug: "ap-japanese",
    units: WORLD_LANGUAGE_UNITS,
  },

  {
    apSubject: "AP Latin",
    slug: "ap-latin",
    units: [
      { unitNumber: 1, unitName: "Vergil's Aeneid, Book 1", description: "Juno's wrath, the storm, Carthage, and Aeneas's arrival — translation and interpretation of required lines." },
      { unitNumber: 2, unitName: "Vergil's Aeneid, Books 2 and 4", description: "Fall of Troy and Dido's tragedy — epic conventions, character, and Vergilian themes." },
      { unitNumber: 3, unitName: "Vergil's Aeneid, Books 6, 8, and 12", description: "Underworld descent, Shield of Aeneas, and final battle — duty, fate, and Roman identity." },
      { unitNumber: 4, unitName: "Caesar's Gallic War, Books 1, 6, and 7", description: "Caesar's prose style, military campaigns, and Roman perspectives on Gallic peoples." },
      { unitNumber: 5, unitName: "Comparative Analysis and Sight Translation", description: "Thematic essay comparing Vergil and Caesar; strategies for unseen Latin sight translation." },
    ],
  },
];

/** Quick lookup by slug */
export function getCatalogExamBySlug(slug: string): CatalogExam | undefined {
  return AP_CATALOG.find((e) => e.slug === slug);
}

/** Quick lookup by apSubject */
export function getCatalogExamBySubject(subject: string): CatalogExam | undefined {
  return AP_CATALOG.find(
    (e) => e.apSubject.toLowerCase() === subject.toLowerCase()
  );
}
