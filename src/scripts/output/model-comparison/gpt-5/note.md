# Unit 1: Atomic Structure and Properties

## Overview
This unit builds the foundation of atomic structure: counting particles with moles, interpreting mass spectrometry and photoelectron spectroscopy, assigning electron configurations, and explaining periodic trends via effective nuclear charge and shielding. Mastery here fuels data-driven reasoning and justifications that the AP exam expects in multiple-choice and free-response.

## Key Concepts at a Glance
| Concept | What It Is | Why It Matters (AP angle) |
|---|---|---|
| Moles & Avogadro’s Number | The link between atomic-scale particles and lab-scale amounts | Converts between particles, mass, and volume in multi-step problems |
| Atomic Mass & Isotopes | Weighted average mass from naturally occurring isotopes | Use data (isotopic abundances) to compute average atomic mass |
| Mass Spectrometry (MS) | Technique that separates ions by mass-to-charge (m/z) to reveal isotopes | Read spectra to deduce isotopic composition and atomic mass |
| Photoelectron Spectroscopy (PES) | Measures kinetic energy of ejected electrons to find binding energies | Assign shells/subshells and infer relative ionization energies |
| Electron Configuration & Orbital Diagrams | Arrangement of electrons in shells/subshells with Pauli, Hund, Aufbau rules | Predict chemical behavior and periodic trends from configurations |
| Effective Nuclear Charge & Shielding | Net positive charge felt by valence electrons after inner-electron shielding | Core rationale for trends in radius, IE, EA, and EN |
| Coulomb’s Law (electrostatic model) | Attraction/repulsion depends on charge and distance | Explains energy levels, PES peaks, and periodic trend directions |
| Periodic Trends | Patterns in atomic/ionic radius, ionization energy, electron affinity, electronegativity | Essential for qualitative comparisons and FRQ justifications |

## Core Processes / Relationships
```mermaid
flowchart TD
  A[Sample of element] --> B["Mass Spectrometry (MS)"]
  B --> C[Isotope peaks (m/z)]
  C --> D[Relative intensities]
  D --> E["Average atomic mass"]

  A --> F[Weigh sample]
  F --> G[Use molar mass]
  G --> H[Moles (counting particles)]

  P[Photons (hν)] --> I["Photoelectron Spectroscopy (PES)"]
  I --> J["KE spectrum"]
  J --> K["Binding energies (BE)"]
  K --> L[Shell/subshell energies]
  L --> M["Electron configuration"]

  M --> N["Shielding & Z_eff"]
  N --> O["Periodic trends: radius, IE, EA, EN"]

  Q["Coulomb's law"] --> K
  Q --> O
  N --> Q
```

## Essential Formulas / Laws / Rules
- Moles, particles, and mass:
  $$n=\frac{m}{M} \quad;\quad N = nN_A \quad;\quad N_A = 6.022\times10^{23}\ \text{mol}^{-1}$$

- Average atomic mass from isotopes:
  $$\bar{m}=\sum_i f_i m_i \quad\text{with}\quad \sum_i f_i=1$$
  $$f_i=\frac{I_i}{\sum I_i}\ \ (\text{from MS peak intensities})$$

- Photoelectron spectroscopy (energy conservation):
  $$E_{\text{photon}} = \text{KE}_{\text{electron}} + \text{BE} \quad\Rightarrow\quad \text{BE} = h\nu - \text{KE}$$
  $$E = h\nu = \frac{hc}{\lambda}$$

- Coulombic attraction (qualitative energy dependence):
  $$E \propto \frac{q_1 q_2}{r} \quad;\quad F \propto \frac{q_1 q_2}{r^2}$$

- Effective nuclear charge (approximate):
  $$Z_{\text{eff}} = Z - S$$

- Qualitative scaling for outer-electron energy/IE:
  $$\text{IE} \uparrow \text{ as } Z_{\text{eff}} \uparrow \text{ and } n \downarrow \quad (\text{roughly } E \propto \frac{Z_{\text{eff}}^{2}}{n^{2}})$$

- Electron configuration example (Cl):
  $$1s^2\,2s^2\,2p^6\,3s^2\,3p^5$$

- Rules to apply:
  - Pauli Exclusion: max 2 e− per orbital with opposite spins.
  - Hund’s Rule: maximize unpaired electrons in degenerate orbitals.
  - Aufbau Principle: fill lower-energy orbitals before higher (with known 4s/3d and 5s/4d order exceptions in stability rationales).

## Connections & Comparisons
| Topic A | Topic B | What to Compare/Contrast (AP use) |
|---|---|---|
| Mass Spectrometry (MS) | Photoelectron Spectroscopy (PES) | MS gives isotope m/z and percent abundance → average atomic mass; PES gives electron binding energies → shell/subshell structure and relative IE. |
| First Ionization Energy (IE1) | Electron Affinity (EA) | IE1 = energy required to remove valence e− (always endothermic); EA = energy change when atom gains an e− (often exothermic). Both trend with Z_eff and n but measure different processes. |
| Atomic Radius | Ionic Radius | Cations are smaller than their atoms (e− removed, Z_eff per electron ↑); anions are larger (e− added, e−–e− repulsion ↑). Across a period, atomic radius ↓; down a group, ↑. |
| Electronegativity (EN) | Ionization Energy (IE) | Both generally increase across a period and decrease down a group; EN is a bonding property (electron pull in a bond), IE is an atomic property (removal from isolated atom). |

## Common AP Exam Traps
- Treating average atomic mass as a simple average instead of a weighted average from isotope abundances.
- Ignoring charge in MS: peaks are at m/z; a 2+ ion appears at half the mass value you might expect for 1+.
- Misreading PES axes: the x-axis is binding energy (often increasing to the left); peak height reflects number of electrons in that subshell.
- Assuming trends without justification: always explain with Z_eff, shielding, and distance (Coulombic reasoning), and note known exceptions (e.g., IE drops from Be→B and N→O).
- Removing electrons from the wrong orbitals in transition metals: cations lose from the highest n (e.g., 4s before 3d) first.

## Quick Review Checklist
- [ ] Convert between mass, moles, and particles using molar mass and Avogadro’s number.
- [ ] From an MS spectrum, compute isotope abundances and the element’s average atomic mass.
- [ ] Interpret a PES spectrum to assign shell/subshell peaks and determine relative binding energies.
- [ ] Write ground-state electron configurations and orbital diagrams; apply Pauli, Hund, and Aufbau correctly (including common transition-metal exceptions).
- [ ] Explain periodic trends (atomic radius, IE, EA, EN) using shielding and Z_eff, citing Coulombic attraction and principal energy level (n).
- [ ] Predict and compare sizes of atoms vs. their cations/anions with reasoning.
- [ ] Justify anomalies in trends (e.g., Be/B, N/O for IE) using subshell energy and electron pairing.
- [ ] Use E = hν = hc/λ and E_photon = KE + BE to connect light, electron energies, and PES data.