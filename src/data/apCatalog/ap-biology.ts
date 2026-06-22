import { APExam } from "./types";

const apBiology: APExam = {
  apSubject: "AP Biology",
  units: [
    // ─────────────────────────────────────────────────────────────────────────
    // Unit 1: Chemistry of Life
    // ─────────────────────────────────────────────────────────────────────────
    {
      unitNumber: 1,
      unitName: "Chemistry of Life",
      description:
        "Covers the chemical basis of life including water properties, macromolecules, and how structure determines function.",
      lessons: [
        {
          flashcards: [
            { term: "Hydrogen bond", definition: "A weak attraction between a hydrogen atom with a partial positive charge and an electronegative atom with a partial negative charge." },
            { term: "Cohesion", definition: "The tendency of water molecules to stick together due to hydrogen bonding." },
            { term: "Adhesion", definition: "The attraction of water molecules to other polar surfaces." },
            { term: "pH scale", definition: "A logarithmic scale from 0–14 that measures hydrogen ion concentration; pH 7 is neutral, below is acidic, above is basic." },
            { term: "Buffer", definition: "A substance that minimizes changes in pH by accepting or donating hydrogen ions." },
          ],
          multipleChoice: [
            {
              questionText: "Which property of water allows it to move upward through plant xylem against gravity?",
              options: ["High specific heat", "Cohesion and adhesion", "Polarity alone", "Low surface tension"],
              correctAnswer: "Cohesion and adhesion",
              lessonType: "multipleChoice",
            },
            {
              questionText: "A solution with a pH of 3 has how many times more H⁺ ions than a solution with a pH of 5?",
              options: ["2", "10", "100", "1000"],
              correctAnswer: "100",
              lessonType: "multipleChoice",
            },
          ],
          fillInTheBlank: [
            {
              questionText: "Water is described as the ______ of life because it is essential for biochemical reactions.",
              options: ["solvent", "catalyst", "substrate", "buffer"],
              correctAnswer: "solvent",
              lessonType: "fillInTheBlank",
            },
            {
              questionText: "A ______ resists changes in pH by neutralizing added acids or bases.",
              options: ["buffer", "solute", "colloid", "isotope"],
              correctAnswer: "buffer",
              lessonType: "fillInTheBlank",
            },
          ],
        },
        {
          flashcards: [
            { term: "Monomer", definition: "A small molecular unit that is the building block of a polymer." },
            { term: "Polymer", definition: "A large molecule made of many repeating monomer units linked by covalent bonds." },
            { term: "Dehydration synthesis", definition: "A reaction in which two monomers are joined by removing a water molecule." },
            { term: "Hydrolysis", definition: "A reaction in which a polymer is broken apart by adding water." },
            { term: "Protein", definition: "A macromolecule made of amino acid monomers; performs structural, enzymatic, and signaling roles." },
          ],
          multipleChoice: [
            {
              questionText: "Which reaction breaks down a polysaccharide into its monosaccharide subunits?",
              options: ["Dehydration synthesis", "Hydrolysis", "Phosphorylation", "Oxidative phosphorylation"],
              correctAnswer: "Hydrolysis",
              lessonType: "multipleChoice",
            },
            {
              questionText: "The monomers of proteins are:",
              options: ["Nucleotides", "Fatty acids", "Amino acids", "Monosaccharides"],
              correctAnswer: "Amino acids",
              lessonType: "multipleChoice",
            },
          ],
          fillInTheBlank: [
            {
              questionText: "Building a polymer from monomers by removing water is called ______ synthesis.",
              options: ["dehydration", "hydrolysis", "condensation polymerization", "oxidative"],
              correctAnswer: "dehydration",
              lessonType: "fillInTheBlank",
            },
            {
              questionText: "Nucleic acids are polymers made up of ______ monomers.",
              options: ["nucleotide", "amino acid", "monosaccharide", "glycerol"],
              correctAnswer: "nucleotide",
              lessonType: "fillInTheBlank",
            },
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Unit 2: Cell Structure and Function
    // ─────────────────────────────────────────────────────────────────────────
    {
      unitNumber: 2,
      unitName: "Cell Structure and Function",
      description:
        "Examines prokaryotic and eukaryotic cell structures, organelle functions, and membrane transport.",
      lessons: [
        {
          flashcards: [
            { term: "Prokaryote", definition: "A cell lacking a membrane-bound nucleus and membrane-bound organelles (e.g., bacteria)." },
            { term: "Eukaryote", definition: "A cell with a membrane-bound nucleus and specialized organelles." },
            { term: "Mitochondrion", definition: "The organelle that generates most of the cell's ATP through cellular respiration; has its own DNA." },
            { term: "Chloroplast", definition: "The organelle in plant/algal cells that converts light energy into chemical energy via photosynthesis." },
            { term: "Ribosome", definition: "A molecular machine that synthesizes proteins by translating mRNA; found in all cells." },
          ],
          multipleChoice: [
            {
              questionText: "Which organelle is the site of protein synthesis in both prokaryotic and eukaryotic cells?",
              options: ["Mitochondrion", "Ribosome", "Golgi apparatus", "Lysosome"],
              correctAnswer: "Ribosome",
              lessonType: "multipleChoice",
            },
            {
              questionText: "The endosymbiotic theory proposes that mitochondria and chloroplasts evolved from:",
              options: ["Eukaryotic nuclei", "Engulfed prokaryotes", "Viral insertions", "Plasmid fusion"],
              correctAnswer: "Engulfed prokaryotes",
              lessonType: "multipleChoice",
            },
          ],
          fillInTheBlank: [
            {
              questionText: "Cells that lack a membrane-bound nucleus are called ______.",
              options: ["prokaryotes", "eukaryotes", "archaea", "viruses"],
              correctAnswer: "prokaryotes",
              lessonType: "fillInTheBlank",
            },
            {
              questionText: "The ______ is often called the powerhouse of the cell because it produces ATP.",
              options: ["mitochondrion", "nucleus", "ribosome", "vacuole"],
              correctAnswer: "mitochondrion",
              lessonType: "fillInTheBlank",
            },
          ],
        },
        {
          flashcards: [
            { term: "Phospholipid bilayer", definition: "The structural basis of cell membranes; two layers of phospholipids with hydrophilic heads facing outward and hydrophobic tails facing inward." },
            { term: "Selective permeability", definition: "The property of the plasma membrane that allows some substances to pass freely while restricting others." },
            { term: "Osmosis", definition: "The diffusion of water across a selectively permeable membrane from an area of lower solute concentration to higher solute concentration." },
            { term: "Active transport", definition: "The movement of molecules against their concentration gradient using ATP energy and membrane proteins." },
            { term: "Endocytosis", definition: "The process by which a cell engulfs material by folding the plasma membrane around it to form a vesicle." },
          ],
          multipleChoice: [
            {
              questionText: "A cell placed in a hypertonic solution will:",
              options: ["Swell and potentially burst", "Shrink as water leaves by osmosis", "Remain unchanged", "Actively pump water in"],
              correctAnswer: "Shrink as water leaves by osmosis",
              lessonType: "multipleChoice",
            },
            {
              questionText: "Which transport process requires ATP?",
              options: ["Simple diffusion", "Facilitated diffusion", "Osmosis", "Active transport"],
              correctAnswer: "Active transport",
              lessonType: "multipleChoice",
            },
          ],
          fillInTheBlank: [
            {
              questionText: "Water moves by ______ from areas of low solute concentration to high solute concentration.",
              options: ["osmosis", "active transport", "exocytosis", "facilitated diffusion"],
              correctAnswer: "osmosis",
              lessonType: "fillInTheBlank",
            },
            {
              questionText: "The cell membrane is described as a ______ mosaic because proteins float in the phospholipid bilayer.",
              options: ["fluid", "rigid", "crystalline", "static"],
              correctAnswer: "fluid",
              lessonType: "fillInTheBlank",
            },
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Unit 3: Cellular Energetics
    // ─────────────────────────────────────────────────────────────────────────
    {
      unitNumber: 3,
      unitName: "Cellular Energetics",
      description:
        "Covers enzyme function, photosynthesis, and cellular respiration, including glycolysis, the Krebs cycle, and the electron transport chain.",
      lessons: [
        {
          flashcards: [
            { term: "Enzyme", definition: "A biological catalyst (usually a protein) that speeds up chemical reactions by lowering activation energy." },
            { term: "Active site", definition: "The region of an enzyme where the substrate binds and the reaction takes place." },
            { term: "Substrate", definition: "The specific reactant molecule that an enzyme acts upon." },
            { term: "Activation energy", definition: "The minimum energy required to start a chemical reaction; enzymes lower this barrier." },
            { term: "Competitive inhibitor", definition: "A molecule that blocks enzyme activity by binding to the active site, competing with the substrate." },
          ],
          multipleChoice: [
            {
              questionText: "Raising the temperature beyond an enzyme's optimum will most likely:",
              options: ["Increase reaction rate indefinitely", "Denature the enzyme", "Lower activation energy further", "Have no effect"],
              correctAnswer: "Denature the enzyme",
              lessonType: "multipleChoice",
            },
            {
              questionText: "A competitive inhibitor reduces enzyme activity by:",
              options: ["Changing the shape of the active site", "Binding to the allosteric site", "Binding to the active site and blocking substrate entry", "Increasing activation energy"],
              correctAnswer: "Binding to the active site and blocking substrate entry",
              lessonType: "multipleChoice",
            },
          ],
          fillInTheBlank: [
            {
              questionText: "Enzymes speed up reactions by lowering ______ energy.",
              options: ["activation", "free", "kinetic", "potential"],
              correctAnswer: "activation",
              lessonType: "fillInTheBlank",
            },
            {
              questionText: "The specific molecule an enzyme catalyzes is called the ______.",
              options: ["substrate", "product", "inhibitor", "cofactor"],
              correctAnswer: "substrate",
              lessonType: "fillInTheBlank",
            },
          ],
        },
        {
          flashcards: [
            { term: "ATP (adenosine triphosphate)", definition: "The primary energy currency of cells; energy is released when the terminal phosphate bond is broken." },
            { term: "Glycolysis", definition: "The first stage of cellular respiration; glucose is split into two pyruvate molecules in the cytoplasm, yielding 2 net ATP." },
            { term: "Krebs cycle", definition: "The second stage of aerobic respiration; acetyl-CoA is oxidized in the mitochondrial matrix, producing NADH, FADH₂, and CO₂." },
            { term: "Electron transport chain (ETC)", definition: "A series of membrane proteins in the inner mitochondrial membrane that transfer electrons and pump H⁺ ions to drive ATP synthesis." },
            { term: "Chemiosmosis", definition: "The synthesis of ATP driven by the flow of H⁺ ions through ATP synthase down their concentration gradient." },
          ],
          multipleChoice: [
            {
              questionText: "Where does glycolysis occur in the cell?",
              options: ["Mitochondrial matrix", "Inner mitochondrial membrane", "Cytoplasm", "Nucleus"],
              correctAnswer: "Cytoplasm",
              lessonType: "multipleChoice",
            },
            {
              questionText: "The most ATP is produced during which stage of aerobic respiration?",
              options: ["Glycolysis", "Pyruvate oxidation", "Krebs cycle", "Electron transport chain / oxidative phosphorylation"],
              correctAnswer: "Electron transport chain / oxidative phosphorylation",
              lessonType: "multipleChoice",
            },
          ],
          fillInTheBlank: [
            {
              questionText: "ATP synthase uses the flow of ______ ions to produce ATP.",
              options: ["hydrogen (H⁺)", "sodium", "chloride", "calcium"],
              correctAnswer: "hydrogen (H⁺)",
              lessonType: "fillInTheBlank",
            },
            {
              questionText: "Glycolysis produces a net gain of ______ ATP molecules per glucose.",
              options: ["2", "4", "32", "36"],
              correctAnswer: "2",
              lessonType: "fillInTheBlank",
            },
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Unit 4: Cell Communication and Cell Cycle
    // ─────────────────────────────────────────────────────────────────────────
    {
      unitNumber: 4,
      unitName: "Cell Communication and Cell Cycle",
      description:
        "Explores signal transduction pathways, cell-to-cell communication, and the stages of the cell cycle including mitosis and its regulation.",
      lessons: [
        {
          flashcards: [
            { term: "Signal transduction", definition: "The process by which a chemical signal is converted into a cellular response through a cascade of molecular events." },
            { term: "Receptor protein", definition: "A protein on or inside a target cell that binds a specific signaling molecule (ligand) and triggers a response." },
            { term: "Second messenger", definition: "A small intracellular signaling molecule (e.g., cAMP) that relays a signal from a surface receptor to intracellular targets." },
            { term: "Phosphorylation cascade", definition: "A series of sequential protein activations by kinases that amplifies a cellular signal." },
            { term: "Apoptosis", definition: "Programmed cell death; a controlled process that eliminates damaged or unneeded cells without causing inflammation." },
          ],
          multipleChoice: [
            {
              questionText: "In a signal transduction pathway, the sequence of events is:",
              options: ["Response → Transduction → Reception", "Reception → Transduction → Response", "Transduction → Reception → Response", "Reception → Response → Transduction"],
              correctAnswer: "Reception → Transduction → Response",
              lessonType: "multipleChoice",
            },
            {
              questionText: "cAMP is an example of a:",
              options: ["Receptor protein", "Second messenger", "Transcription factor", "Hormone receptor"],
              correctAnswer: "Second messenger",
              lessonType: "multipleChoice",
            },
          ],
          fillInTheBlank: [
            {
              questionText: "Programmed cell death is called ______.",
              options: ["apoptosis", "necrosis", "lysis", "differentiation"],
              correctAnswer: "apoptosis",
              lessonType: "fillInTheBlank",
            },
            {
              questionText: "A ______ cascade amplifies a signal by sequentially activating proteins through phosphorylation.",
              options: ["phosphorylation", "transcription", "translation", "replication"],
              correctAnswer: "phosphorylation",
              lessonType: "fillInTheBlank",
            },
          ],
        },
        {
          flashcards: [
            { term: "Cell cycle", definition: "The ordered sequence of events a cell goes through from its origin to its division into two daughter cells; includes interphase and mitotic phase." },
            { term: "Interphase", definition: "The phase of the cell cycle (G₁, S, G₂) during which the cell grows and replicates its DNA." },
            { term: "Mitosis", definition: "Nuclear division that produces two genetically identical daughter nuclei; stages are prophase, metaphase, anaphase, telophase." },
            { term: "Cytokinesis", definition: "Division of the cytoplasm following mitosis, producing two separate daughter cells." },
            { term: "Cyclin-CDK complex", definition: "A regulatory protein complex that drives progression through cell cycle checkpoints." },
          ],
          multipleChoice: [
            {
              questionText: "During which phase of mitosis do chromosomes align along the cell's equatorial plate?",
              options: ["Prophase", "Metaphase", "Anaphase", "Telophase"],
              correctAnswer: "Metaphase",
              lessonType: "multipleChoice",
            },
            {
              questionText: "DNA replication occurs during which sub-phase of interphase?",
              options: ["G₁", "S phase", "G₂", "M phase"],
              correctAnswer: "S phase",
              lessonType: "multipleChoice",
            },
          ],
          fillInTheBlank: [
            {
              questionText: "Sister chromatids separate and move to opposite poles during ______ of mitosis.",
              options: ["anaphase", "metaphase", "prophase", "telophase"],
              correctAnswer: "anaphase",
              lessonType: "fillInTheBlank",
            },
            {
              questionText: "Cyclin-______ complexes regulate progression through cell cycle checkpoints.",
              options: ["CDK", "ATP", "RNA", "ADP"],
              correctAnswer: "CDK",
              lessonType: "fillInTheBlank",
            },
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Unit 5: Heredity
    // ─────────────────────────────────────────────────────────────────────────
    {
      unitNumber: 5,
      unitName: "Heredity",
      description:
        "Covers meiosis, Mendelian and non-Mendelian inheritance patterns, and the chromosomal basis of inheritance.",
      lessons: [
        {
          flashcards: [
            { term: "Meiosis", definition: "Cell division that produces four genetically unique haploid gametes from a single diploid cell." },
            { term: "Crossing over (recombination)", definition: "The exchange of genetic material between homologous chromosomes during prophase I, creating new allele combinations." },
            { term: "Independent assortment", definition: "Mendel's second law; homologous chromosome pairs orient randomly at metaphase I, so each gamete gets a random mix of maternal and paternal chromosomes." },
            { term: "Dominant allele", definition: "An allele that is expressed in the phenotype whenever it is present, even in heterozygous individuals." },
            { term: "Recessive allele", definition: "An allele that is expressed only when two copies are present (homozygous recessive)." },
          ],
          multipleChoice: [
            {
              questionText: "Which of the following occurs during prophase I of meiosis but NOT during mitosis?",
              options: ["Chromosome condensation", "Nuclear envelope breakdown", "Crossing over between homologous chromosomes", "Spindle formation"],
              correctAnswer: "Crossing over between homologous chromosomes",
              lessonType: "multipleChoice",
            },
            {
              questionText: "A cross between two heterozygous individuals (Aa × Aa) produces offspring in what phenotypic ratio (dominant:recessive)?",
              options: ["1:1", "3:1", "1:2:1", "2:1"],
              correctAnswer: "3:1",
              lessonType: "multipleChoice",
            },
          ],
          fillInTheBlank: [
            {
              questionText: "Meiosis produces ______ haploid daughter cells from one diploid parent cell.",
              options: ["four", "two", "eight", "one"],
              correctAnswer: "four",
              lessonType: "fillInTheBlank",
            },
            {
              questionText: "The exchange of segments between homologous chromosomes during meiosis I is called ______.",
              options: ["crossing over", "independent assortment", "segregation", "fertilization"],
              correctAnswer: "crossing over",
              lessonType: "fillInTheBlank",
            },
          ],
        },
        {
          flashcards: [
            { term: "Incomplete dominance", definition: "A pattern of inheritance in which the heterozygous phenotype is intermediate between the two homozygous phenotypes." },
            { term: "Codominance", definition: "Both alleles are fully expressed simultaneously in a heterozygous individual (e.g., AB blood type)." },
            { term: "Sex-linked trait", definition: "A trait controlled by a gene located on a sex chromosome (usually the X chromosome)." },
            { term: "Epistasis", definition: "An interaction in which one gene masks or modifies the expression of a different gene." },
            { term: "Pedigree", definition: "A diagram that traces the inheritance of a trait through several generations of a family." },
          ],
          multipleChoice: [
            {
              questionText: "A man with red-green color blindness (X-linked recessive) has children with a homozygous dominant woman. What fraction of their sons will be color blind?",
              options: ["0", "1/4", "1/2", "All"],
              correctAnswer: "0",
              lessonType: "multipleChoice",
            },
            {
              questionText: "In codominance, heterozygous individuals show:",
              options: ["Only the dominant phenotype", "Only the recessive phenotype", "An intermediate phenotype", "Both parental phenotypes simultaneously"],
              correctAnswer: "Both parental phenotypes simultaneously",
              lessonType: "multipleChoice",
            },
          ],
          fillInTheBlank: [
            {
              questionText: "When neither allele is dominant and the heterozygote shows a blend of both phenotypes, this is called ______ dominance.",
              options: ["incomplete", "co", "epistatic", "recessive"],
              correctAnswer: "incomplete",
              lessonType: "fillInTheBlank",
            },
            {
              questionText: "A gene located on the X chromosome controls a ______ trait.",
              options: ["sex-linked", "autosomal", "polygenic", "epistatic"],
              correctAnswer: "sex-linked",
              lessonType: "fillInTheBlank",
            },
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Unit 6: Gene Expression and Regulation
    // ─────────────────────────────────────────────────────────────────────────
    {
      unitNumber: 6,
      unitName: "Gene Expression and Regulation",
      description:
        "Covers DNA structure, replication, transcription, translation, and how gene expression is regulated in prokaryotes and eukaryotes.",
      lessons: [
        {
          flashcards: [
            { term: "DNA replication", definition: "The process of copying a DNA double helix into two identical daughter helices; semi-conservative." },
            { term: "Transcription", definition: "The synthesis of an mRNA molecule from a DNA template; occurs in the nucleus of eukaryotes." },
            { term: "Translation", definition: "The synthesis of a protein from the mRNA sequence at the ribosome; uses tRNA and codons." },
            { term: "Codon", definition: "A three-nucleotide sequence in mRNA that specifies a particular amino acid or a stop signal." },
            { term: "RNA polymerase", definition: "The enzyme that catalyzes transcription by synthesizing an RNA strand complementary to the DNA template." },
          ],
          multipleChoice: [
            {
              questionText: "During translation, which molecule carries amino acids to the ribosome?",
              options: ["mRNA", "rRNA", "tRNA", "DNA"],
              correctAnswer: "tRNA",
              lessonType: "multipleChoice",
            },
            {
              questionText: "The central dogma of molecular biology states that information flows from:",
              options: ["Protein → RNA → DNA", "DNA → RNA → Protein", "RNA → DNA → Protein", "Protein → DNA → RNA"],
              correctAnswer: "DNA → RNA → Protein",
              lessonType: "multipleChoice",
            },
          ],
          fillInTheBlank: [
            {
              questionText: "The enzyme that synthesizes RNA from a DNA template is called ______ polymerase.",
              options: ["RNA", "DNA", "protein", "amino acid"],
              correctAnswer: "RNA",
              lessonType: "fillInTheBlank",
            },
            {
              questionText: "A three-base sequence on mRNA that codes for a specific amino acid is called a ______.",
              options: ["codon", "anticodon", "intron", "exon"],
              correctAnswer: "codon",
              lessonType: "fillInTheBlank",
            },
          ],
        },
        {
          flashcards: [
            { term: "Operon", definition: "A prokaryotic gene-regulatory unit consisting of a promoter, operator, and a cluster of functionally related genes (e.g., lac operon)." },
            { term: "Transcription factor", definition: "A protein that binds to specific DNA sequences and promotes or inhibits transcription in eukaryotes." },
            { term: "Epigenetics", definition: "Changes in gene expression that do not involve alterations to the DNA sequence; includes DNA methylation and histone modification." },
            { term: "Alternative splicing", definition: "A process where different combinations of exons in a pre-mRNA are joined to produce multiple protein variants from one gene." },
            { term: "microRNA (miRNA)", definition: "Small non-coding RNA molecules that bind to complementary mRNA sequences and inhibit translation or promote mRNA degradation." },
          ],
          multipleChoice: [
            {
              questionText: "In the lac operon, when lactose is absent:",
              options: ["The repressor is inactive and genes are transcribed", "The repressor binds the operator and blocks transcription", "RNA polymerase is degraded", "The structural genes are constitutively expressed"],
              correctAnswer: "The repressor binds the operator and blocks transcription",
              lessonType: "multipleChoice",
            },
            {
              questionText: "Alternative splicing increases proteome diversity by:",
              options: ["Mutating exons", "Combining different exons from the same pre-mRNA in different ways", "Duplicating genes", "Methylating histones"],
              correctAnswer: "Combining different exons from the same pre-mRNA in different ways",
              lessonType: "multipleChoice",
            },
          ],
          fillInTheBlank: [
            {
              questionText: "The lac operon is turned ON when lactose binds the ______, causing it to detach from the operator.",
              options: ["repressor", "RNA polymerase", "ribosome", "promoter"],
              correctAnswer: "repressor",
              lessonType: "fillInTheBlank",
            },
            {
              questionText: "DNA methylation and histone modification are examples of ______ regulation.",
              options: ["epigenetic", "post-translational", "operon", "allosteric"],
              correctAnswer: "epigenetic",
              lessonType: "fillInTheBlank",
            },
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Unit 7: Natural Selection
    // ─────────────────────────────────────────────────────────────────────────
    {
      unitNumber: 7,
      unitName: "Natural Selection",
      description:
        "Explores the mechanisms of evolution including natural selection, genetic drift, gene flow, and speciation.",
      lessons: [
        {
          flashcards: [
            { term: "Natural selection", definition: "The process by which heritable traits that increase reproductive success become more common in a population over successive generations." },
            { term: "Fitness", definition: "An organism's relative ability to survive and reproduce in its environment." },
            { term: "Adaptation", definition: "An inherited characteristic that enhances an organism's survival and reproduction in a specific environment." },
            { term: "Directional selection", definition: "Natural selection that favors one extreme phenotype, shifting the population's average trait value in that direction." },
            { term: "Stabilizing selection", definition: "Natural selection that favors intermediate phenotypes, reducing variation in the population." },
          ],
          multipleChoice: [
            {
              questionText: "Which condition is NOT required for natural selection to occur?",
              options: ["Variation in traits", "Heritability of traits", "Differential reproductive success", "Isolation of populations"],
              correctAnswer: "Isolation of populations",
              lessonType: "multipleChoice",
            },
            {
              questionText: "Sickle-cell trait being maintained at high frequency in malaria-endemic regions is an example of:",
              options: ["Directional selection", "Stabilizing selection", "Disruptive selection", "Balancing selection"],
              correctAnswer: "Balancing selection",
              lessonType: "multipleChoice",
            },
          ],
          fillInTheBlank: [
            {
              questionText: "An organism's ______ is its relative ability to survive and reproduce in a given environment.",
              options: ["fitness", "adaptation", "genotype", "phenotype"],
              correctAnswer: "fitness",
              lessonType: "fillInTheBlank",
            },
            {
              questionText: "______ selection favors intermediate phenotypes and reduces the extremes in a population.",
              options: ["Stabilizing", "Directional", "Disruptive", "Sexual"],
              correctAnswer: "Stabilizing",
              lessonType: "fillInTheBlank",
            },
          ],
        },
        {
          flashcards: [
            { term: "Genetic drift", definition: "Random changes in allele frequencies in a population, especially impactful in small populations." },
            { term: "Bottleneck effect", definition: "A drastic reduction in population size that causes a loss of genetic diversity." },
            { term: "Founder effect", definition: "Genetic drift that occurs when a small group colonizes a new area, carrying only a subset of the original population's alleles." },
            { term: "Gene flow", definition: "The transfer of alleles between populations through migration, which can increase or decrease genetic diversity." },
            { term: "Speciation", definition: "The evolutionary process by which new species arise; allopatric speciation involves geographic isolation." },
          ],
          multipleChoice: [
            {
              questionText: "Which event would most likely produce the founder effect?",
              options: ["A large population experiencing mild climate change", "A small group migrating to an isolated island", "Two large populations merging", "A population losing individuals to disease over many generations"],
              correctAnswer: "A small group migrating to an isolated island",
              lessonType: "multipleChoice",
            },
            {
              questionText: "Gene flow tends to:",
              options: ["Increase genetic differences between populations", "Decrease genetic differences between populations", "Have no effect on allele frequencies", "Always reduce fitness"],
              correctAnswer: "Decrease genetic differences between populations",
              lessonType: "multipleChoice",
            },
          ],
          fillInTheBlank: [
            {
              questionText: "Random changes in allele frequency in small populations are called genetic ______.",
              options: ["drift", "flow", "mutation", "selection"],
              correctAnswer: "drift",
              lessonType: "fillInTheBlank",
            },
            {
              questionText: "When a small subgroup founds a new population, carrying limited genetic diversity, this is the ______ effect.",
              options: ["founder", "bottleneck", "Hardy-Weinberg", "drift"],
              correctAnswer: "founder",
              lessonType: "fillInTheBlank",
            },
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // Unit 8: Ecology
    // ─────────────────────────────────────────────────────────────────────────
    {
      unitNumber: 8,
      unitName: "Ecology",
      description:
        "Examines population ecology, community interactions, ecosystem energy flow, and the cycling of matter.",
      lessons: [
        {
          flashcards: [
            { term: "Population", definition: "A group of individuals of the same species living in the same area at the same time." },
            { term: "Carrying capacity (K)", definition: "The maximum population size that an environment can sustainably support given available resources." },
            { term: "Logistic growth", definition: "Population growth that slows as the population approaches carrying capacity, producing an S-shaped curve." },
            { term: "Exponential growth", definition: "Unrestricted population growth at a constant rate, producing a J-shaped curve; occurs when resources are unlimited." },
            { term: "Competitive exclusion principle", definition: "Two species competing for identical resources cannot coexist indefinitely; one will outcompete and displace the other." },
          ],
          multipleChoice: [
            {
              questionText: "A J-shaped population growth curve indicates:",
              options: ["Logistic growth approaching carrying capacity", "Exponential growth with unlimited resources", "Population decline due to predation", "Density-dependent limiting factors"],
              correctAnswer: "Exponential growth with unlimited resources",
              lessonType: "multipleChoice",
            },
            {
              questionText: "According to the competitive exclusion principle, two species competing for identical resources will:",
              options: ["Evolve to be identical", "Always coexist stably", "Not be able to coexist indefinitely", "Increase each other's carrying capacity"],
              correctAnswer: "Not be able to coexist indefinitely",
              lessonType: "multipleChoice",
            },
          ],
          fillInTheBlank: [
            {
              questionText: "The maximum population size an environment can support is called the ______ capacity.",
              options: ["carrying", "biotic", "limiting", "exponential"],
              correctAnswer: "carrying",
              lessonType: "fillInTheBlank",
            },
            {
              questionText: "An S-shaped population growth curve is characteristic of ______ growth.",
              options: ["logistic", "exponential", "geometric", "linear"],
              correctAnswer: "logistic",
              lessonType: "fillInTheBlank",
            },
          ],
        },
        {
          flashcards: [
            { term: "Trophic level", definition: "Each step in a food chain or food web; producers are at the first trophic level, primary consumers at the second, etc." },
            { term: "10% rule", definition: "Only about 10% of the energy stored at one trophic level is transferred to the next; 90% is lost as heat." },
            { term: "Nitrogen cycle", definition: "The biogeochemical cycle by which nitrogen is converted between its various chemical forms, including fixation, nitrification, and denitrification." },
            { term: "Keystone species", definition: "A species with a disproportionately large effect on its ecosystem relative to its abundance." },
            { term: "Ecosystem engineers", definition: "Organisms that physically modify habitats in ways that affect the availability of resources for other species." },
          ],
          multipleChoice: [
            {
              questionText: "If a producer stores 10,000 kcal of energy, approximately how much energy is available to a secondary consumer?",
              options: ["1,000 kcal", "100 kcal", "10 kcal", "1 kcal"],
              correctAnswer: "100 kcal",
              lessonType: "multipleChoice",
            },
            {
              questionText: "Bacteria that convert atmospheric N₂ into ammonia (NH₃) are performing:",
              options: ["Nitrification", "Denitrification", "Nitrogen fixation", "Ammonification"],
              correctAnswer: "Nitrogen fixation",
              lessonType: "multipleChoice",
            },
          ],
          fillInTheBlank: [
            {
              questionText: "Approximately ______ of energy is transferred from one trophic level to the next.",
              options: ["10%", "50%", "90%", "100%"],
              correctAnswer: "10%",
              lessonType: "fillInTheBlank",
            },
            {
              questionText: "A ______ species has a disproportionately large effect on its ecosystem relative to its biomass.",
              options: ["keystone", "producer", "decomposer", "pioneer"],
              correctAnswer: "keystone",
              lessonType: "fillInTheBlank",
            },
          ],
        },
      ],
    },
  ],
};

export default apBiology;
