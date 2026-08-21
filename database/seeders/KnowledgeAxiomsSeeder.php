<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class KnowledgeAxiomsSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Define all 22 fragments and their folder/file mappings in logical dependency order
        $fragments = [
            1 => [
                'name' => 'CPU Absolute Roots',
                'files' => [] // Seeded statically
            ],
            2 => [
                'name' => 'Metaphysics & Ontology (Base Foundations)',
                'files' => [
                    'formal_logic/ontology/foundational_axioms.json',
                    'formal_logic/metaphysics/foundational_axioms.json',
                    'logic/formal_logic/foundational_axioms.json'
                ]
            ],
            3 => [
                'name' => 'Propositional, Epistemic & Formal Logic',
                'files' => [
                    'formal_logic/formal_logic/foundational_axioms.json',
                    'formal_logic/boolean_logic/foundational_axioms.json',
                    'formal_logic/symbolic_logic/foundational_axioms.json',
                    'formal_logic/epistemology/foundational_axioms.json',
                    'formal_logic/epistemic_logic/foundational_axioms.json',
                    'formal_logic/deontic_logic/foundational_axioms.json',
                    'formal_logic/preference_logic/foundational_axioms.json',
                    'formal_logic/predicate_logic/foundational_axioms.json'
                ]
            ],
            4 => [
                'name' => 'Mathematical Logic & Non-Classical Logics',
                'files' => [
                    'formal_logic/mathematical_logic/foundational_axioms.json',
                    'math/mathematical_logic/foundational_axioms.json',
                    'formal_logic/fuzzy_logic/foundational_axioms.json',
                    'formal_logic/non_classical_logic/foundational_axioms.json',
                    'formal_logic/intuitionistic_logic/foundational_axioms.json',
                    'formal_logic/paraconsistent_logic/foundational_axioms.json',
                    'formal_logic/temporal_logic/foundational_axioms.json',
                    'formal_logic/dialectics/foundational_axioms.json',
                    'formal_logic/paradox_resolution/foundational_axioms.json',
                    'math/paradox_resolution/foundational_axioms.json',
                    'formal_logic/higher_order_logic/foundational_axioms.json'
                ]
            ],
            5 => [
                'name' => 'Set Theory, Category Theory, & Proof Theory',
                'files' => [
                    'formal_logic/set_theory/foundational_axioms.json',
                    'math/set_theory/foundational_axioms.json',
                    'formal_logic/category_theory/foundational_axioms.json',
                    'formal_logic/proof_theory/foundational_axioms.json',
                    'formal_logic/inductive_logic/foundational_axioms.json',
                    'formal_logic/philosophical_logic/foundational_axioms.json',
                    'formal_logic/modal_logic/foundational_axioms.json'
                ]
            ],
            6 => [
                'name' => 'Number Theory & Arithmetic (Math Backbone)',
                'files' => [
                    'mathematics/arithmetic/foundational_axioms.json',
                    'mathematics/number_theory/foundational_axioms.json',
                    'math/number_theory/foundational_axioms.json',
                    'math/mathematics/foundational_axioms.json',
                    'mathematics_axioms.json'
                ]
            ],
            7 => [
                'name' => 'Algebra & Mathematical Analysis (Calculus)',
                'files' => [
                    'mathematics/algebra/foundational_axioms.json',
                    'mathematics/calculus/foundational_axioms.json',
                    'general/linear_algebra/foundational_axioms.json',
                    'general/differential_equations/foundational_axioms.json'
                ]
            ],
            8 => [
                'name' => 'Geometry & Topology',
                'files' => [
                    'mathematics/geometry/foundational_axioms.json',
                    'mathematics/topology/foundational_axioms.json',
                    'mathematics/combinatorics/foundational_axioms.json'
                ]
            ],
            9 => [
                'name' => 'Probability, Statistics, & Information Theory',
                'files' => [
                    'mathematics/statistics/foundational_axioms.json',
                    'math/statistics/foundational_axioms.json',
                    'mathematics/quantum_probability/foundational_axioms.json',
                    'mathematics/information_theory/foundational_axioms.json'
                ]
            ],
            10 => [
                'name' => 'Classical & Relativistic Physics',
                'files' => [
                    'physics/physics/foundational_axioms.json',
                    'physics/physics_axioms.json',
                    'physics/classical_mechanics/foundational_axioms.json',
                    'physics/relativity/foundational_axioms.json',
                    'physics/general/foundational_axioms.json',
                    'empirical_science/physics/foundational_axioms.json'
                ]
            ],
            11 => [
                'name' => 'Waves, Electromagnetism, & Quantum Mechanics',
                'files' => [
                    'physics/electromagnetism/foundational_axioms.json',
                    'physics/quantum_mechanics/foundational_axioms.json',
                    'physics/optics/foundational_axioms.json',
                    'physics/acoustics/foundational_axioms.json',
                    'physics/fluid_dynamics/foundational_axioms.json',
                    'physics/astrophysics/foundational_axioms.json',
                    'physics/particle_physics/foundational_axioms.json'
                ]
            ],
            12 => [
                'name' => 'General Chemistry, Stoichiometry, & Thermodynamics',
                'files' => [
                    'physics/thermodynamics/foundational_axioms.json',
                    'chemistry/thermo_axioms.json',
                    'chemistry/thermochemistry/foundational_axioms.json',
                    'chemistry/general/foundational_axioms.json',
                    'chemistry/chemistry_axioms.json',
                    'chemistry/stoichiometry/foundational_axioms.json'
                ]
            ],
            13 => [
                'name' => 'Inorganic, Organic, & Quantum Chemistry',
                'files' => [
                    'chemistry/inorganic_chemistry/foundational_axioms.json',
                    'chemistry/organic_chemistry/foundational_axioms.json',
                    'chemistry/physical_chemistry/foundational_axioms.json',
                    'chemistry/quantum_chemistry/foundational_axioms.json',
                    'chemistry/polymer_chemistry/foundational_axioms.json',
                    'chemistry/electrochemistry/foundational_axioms.json',
                    'chemistry/analytical_chemistry/foundational_axioms.json'
                ]
            ],
            14 => [
                'name' => 'Cellular & Molecular Biology',
                'files' => [
                    'biology/cell_biology/foundational_axioms.json',
                    'biology/molecular_biology/foundational_axioms.json',
                    'chemistry/biochemistry/foundational_axioms.json',
                    'biology/microbiology/foundational_axioms.json',
                    'biology/virology/foundational_axioms.json',
                    'biology/immunology/foundational_axioms.json'
                ]
            ],
            15 => [
                'name' => 'Evolutionary Biology & Ecology',
                'files' => [
                    'biology/evolutionary_biology/foundational_axioms.json',
                    'biology/ecology/foundational_axioms.json',
                    'biology/genetics/foundational_axioms.json',
                    'biology/zoology/foundational_axioms.json',
                    'biology/botany/foundational_axioms.json',
                    'biology/paleontology/foundational_axioms.json'
                ]
            ],
            16 => [
                'name' => 'Physiology, Pharmacology, & Medicine',
                'files' => [
                    'biology/physiology/foundational_axioms.json',
                    'biology/pharmacology/foundational_axioms.json',
                    'biology/pathology/foundational_axioms.json',
                    'biology/psychiatry/foundational_axioms.json',
                    'biology/surgery/foundational_axioms.json',
                    'biology/pediatrics/foundational_axioms.json',
                    'biology/neuroscience/foundational_axioms.json',
                    'biology/epidemiology/foundational_axioms.json'
                ]
            ],
            17 => [
                'name' => 'Earth Sciences & Meteorology',
                'files' => [
                    'biology/geology/foundational_axioms.json',
                    'biology/meteorology/foundational_axioms.json',
                    'biology/oceanography/foundational_axioms.json',
                    'biology/seismology/foundational_axioms.json'
                ]
            ],
            18 => [
                'name' => 'Game Theory & Decision Theory',
                'files' => [
                    'mathematics/game_theory/foundational_axioms.json',
                    'mathematics/decision_theory/foundational_axioms.json',
                    'math/game_theory/foundational_axioms.json',
                    'math/decision_theory/foundational_axioms.json'
                ]
            ],
            19 => [
                'name' => 'Information Theory, Cryptography, & AI Software',
                'files' => [
                    'mathematics/cryptography/foundational_axioms.json',
                    'math/cryptography/foundational_axioms.json',
                    'engineering/software_engineering/foundational_axioms.json',
                    'engineering/artificial_intelligence/foundational_axioms.json'
                ]
            ],
            20 => [
                'name' => 'Applied Engineering Fields',
                'files' => [
                    'engineering/electrical_engineering/foundational_axioms.json',
                    'engineering/mechanical_engineering/foundational_axioms.json',
                    'engineering/civil_engineering/foundational_axioms.json',
                    'engineering/chemical_engineering/foundational_axioms.json',
                    'engineering/aerospace_engineering/foundational_axioms.json',
                    'engineering/materials_science/foundational_axioms.json'
                ]
            ],
            21 => [
                'name' => 'Economics & Social Sciences',
                'files' => [
                    'social_science/economics/foundational_axioms.json',
                    'social_science/sociology/foundational_axioms.json',
                    'social_science/political_science/foundational_axioms.json',
                    'social_science/law/foundational_axioms.json',
                    'social_science/anthropology/foundational_axioms.json',
                    'social_science/history/foundational_axioms.json',
                    'social_science/human_geography/foundational_axioms.json',
                    'social_science/linguistics/foundational_axioms.json',
                    'social_science/psychology/foundational_axioms.json',
                    'social_science/epidemiology/foundational_axioms.json',
                    'general/social_science/foundational_axioms.json',
                    'social/social_science/foundational_axioms.json'
                ]
            ],
            22 => [
                'name' => 'Empirical Science Observations',
                'files' => [
                    'empirical/empirical_science/foundational_axioms.json'
                ]
            ],
            23 => [
                'name' => 'Ethics, Aesthetics, & Humanities',
                'files' => [
                    'humanities/ethics/foundational_axioms.json',
                    'humanities/aesthetics/foundational_axioms.json',
                    'humanities/musicology/foundational_axioms.json',
                    'humanities/theology/foundational_axioms.json',
                    'humanities/literature/foundational_axioms.json'
                ]
            ],
            24 => [
                'name' => 'Applied Commerce & Management',
                'files' => [
                    'business/finance/foundational_axioms.json',
                    'business/accounting/foundational_axioms.json',
                    'business/management/foundational_axioms.json',
                    'business/marketing/foundational_axioms.json'
                ]
            ],
            25 => [
                'name' => 'Deep Computer Science & Information Systems',
                'files' => [
                    'computer_science/algorithms/foundational_axioms.json',
                    'computer_science/data_structures/foundational_axioms.json',
                    'computer_science/databases/foundational_axioms.json',
                    'computer_science/networking/foundational_axioms.json'
                ]
            ],
            26 => [
                'name' => 'Applied Medical & Agronomy Sciences',
                'files' => [
                    'medicine/anatomy/foundational_axioms.json',
                    'medicine/nutrition/foundational_axioms.json',
                    'biology/agronomy/foundational_axioms.json'
                ]
            ],
            27 => [
                'name' => 'Applied Arts & Design',
                'files' => [
                    'applied_arts/architecture/foundational_axioms.json',
                    'applied_arts/pedagogy/foundational_axioms.json'
                ]
            ],
            28 => [
                'name' => 'Systems Theory & Complexity',
                'files' => [
                    'interdisciplinary/systems_theory/foundational_axioms.json',
                    'interdisciplinary/cognitive_science/foundational_axioms.json'
                ]
            ],
            29 => [
                'name' => 'History, Archaeology, & Paleontology',
                'files' => [
                    'humanities/archaeology/foundational_axioms.json',
                    'humanities/history_theory/foundational_axioms.json'
                ]
            ],
            30 => [
                'name' => 'Linguistics, Semiotics, & Philology',
                'files' => [
                    'humanities/linguistics/foundational_axioms.json'
                ]
            ],
            31 => [
                'name' => 'Jurisprudence & Legal Theory',
                'files' => [
                    'social_science/jurisprudence/foundational_axioms.json'
                ]
            ],
            32 => [
                'name' => 'Military Science & Strategic Studies',
                'files' => [
                    'interdisciplinary/military_science/foundational_axioms.json'
                ]
            ],
            33 => [
                'name' => 'Kinesiology, Sports Science & Human Performance',
                'files' => [
                    'medicine/kinesiology/foundational_axioms.json'
                ]
            ],
            34 => [
                'name' => 'Media, Communication & Information Science',
                'files' => [
                    'interdisciplinary/media_studies/foundational_axioms.json'
                ]
            ],
            35 => [
                'name' => 'Theology, Mythology & Religious Studies',
                'files' => [
                    'humanities/theology/foundational_axioms.json'
                ]
            ],
            36 => [
                'name' => 'Pedagogy, Andragogy & Educational Sciences',
                'files' => [
                    'social_science/pedagogy/foundational_axioms.json'
                ]
            ],
            37 => [
                'name' => 'Architecture, Urban Planning & Civil Structuring',
                'files' => [
                    'engineering/architecture/foundational_axioms.json'
                ]
            ],
            38 => [
                'name' => 'Culinary Arts, Gastronomy & Food Science',
                'files' => [
                    'applied_science/culinary/foundational_axioms.json'
                ]
            ],
            39 => [
                'name' => 'Space Sciences, Astronautics & Orbital Mechanics',
                'files' => [
                    'physics/astronautics/foundational_axioms.json'
                ]
            ],
            40 => [
                'name' => 'Oceanography & Marine Sciences',
                'files' => [
                    'earth_science/oceanography/foundational_axioms.json'
                ]
            ],
            41 => [
                'name' => 'Forensic Science & Criminology',
                'files' => [
                    'applied_science/forensics/foundational_axioms.json'
                ]
            ],
            42 => [
                'name' => 'Hermeticism, Esotericism & Occult Philosophy',
                'files' => [
                    'humanities/hermeticism/foundational_axioms.json'
                ]
            ],
            43 => [
                'name' => 'Musicology, Dramaturgy & Performing Arts',
                'files' => [
                    'arts/musicology/foundational_axioms.json'
                ]
            ],
            44 => [
                'name' => 'Metrology & Scientific Instrumentation',
                'files' => [
                    'physics/metrology/foundational_axioms.json'
                ]
            ],
            45 => [
                'name' => 'Demography, Actuarial Science & Population Dynamics',
                'files' => [
                    'social_science/demography/foundational_axioms.json'
                ]
            ],
            46 => [
                'name' => 'Futurology, Transhumanism & Extraterrestrial Constructs',
                'files' => [
                    'interdisciplinary/futurology/foundational_axioms.json'
                ]
            ],
            47 => [
                'name' => 'Ergonomics, Human Factors & Interface Design',
                'files' => [
                    'applied_science/ergonomics/foundational_axioms.json'
                ]
            ],
            48 => [
                'name' => 'Philanthropy, Social Work & Community Organization',
                'files' => [
                    'social_science/philanthropy/foundational_axioms.json'
                ]
            ],
            49 => [
                'name' => 'Diplomacy, International Relations & Geopolitics',
                'files' => [
                    'social_science/diplomacy/foundational_axioms.json'
                ]
            ],
            50 => [
                'name' => 'Archival Science, Taxonomy & Museology',
                'files' => [
                    'humanities/archival_science/foundational_axioms.json'
                ]
            ],
            51 => [
                'name' => 'Veterinary Medicine, Ethology & Animal Sciences',
                'files' => [
                    'medicine/veterinary/foundational_axioms.json'
                ]
            ],
            52 => [
                'name' => 'Cartography, Topography & Geodesy',
                'files' => [
                    'earth_science/cartography/foundational_axioms.json'
                ]
            ],
            53 => [
                'name' => 'Horology & Chronometry',
                'files' => [
                    'physics/horology/foundational_axioms.json'
                ]
            ],
            54 => [
                'name' => 'Mining, Metallurgy & Subsurface Engineering',
                'files' => [
                    'engineering/mining/foundational_axioms.json'
                ]
            ],
            55 => [
                'name' => 'Hydrology, Glaciology & Water Management',
                'files' => [
                    'earth_science/hydrology/foundational_axioms.json'
                ]
            ],
            56 => [
                'name' => 'Textile Sciences & Apparel Engineering',
                'files' => [
                    'engineering/textiles/foundational_axioms.json'
                ]
            ],
            57 => [
                'name' => 'Toxicology, Venomics & Poison Sciences',
                'files' => [
                    'biology/toxicology/foundational_axioms.json'
                ]
            ],
            58 => [
                'name' => 'Gerontology, Somnology & Chronobiology',
                'files' => [
                    'medicine/gerontology/foundational_axioms.json'
                ]
            ],
            59 => [
                'name' => 'Genealogy, Heraldry & Prosopography',
                'files' => [
                    'humanities/genealogy/foundational_axioms.json'
                ]
            ],
            60 => [
                'name' => 'Gemology, Mineralogy & Crystallography',
                'files' => [
                    'earth_science/mineralogy/foundational_axioms.json'
                ]
            ],
            61 => [
                'name' => 'Forestry, Silviculture & Dendrology',
                'files' => [
                    'biology/forestry/foundational_axioms.json'
                ]
            ],
            62 => [
                'name' => 'Numismatics, Philately & Exonumia',
                'files' => [
                    'social_science/numismatics/foundational_axioms.json'
                ]
            ],
            63 => [
                'name' => 'Cryptozoology, Ufology & Fringe Syntheses',
                'files' => [
                    'interdisciplinary/fringe_science/foundational_axioms.json'
                ]
            ],
            64 => [
                'name' => 'Ontological Meta-Knowledge (The Final Node)',
                'files' => [
                    'formal_logic/ontological_meta/foundational_axioms.json'
                ]
            ],
            65 => [
                'name' => 'Philosophy of Science & Epistemological Paradigms',
                'files' => [
                    'humanities/philosophy_of_science/foundational_axioms.json'
                ]
            ],
            66 => [
                'name' => 'Operations Research, Logistics & Supply Chain Management',
                'files' => [
                    'business/logistics/foundational_axioms.json'
                ]
            ],
            67 => [
                'name' => 'Control Theory, Cybernetics & Robotics',
                'files' => [
                    'engineering/control_theory/foundational_axioms.json'
                ]
            ],
            68 => [
                'name' => 'Agricultural Science, Soil Chemistry & Permaculture',
                'files' => [
                    'biology/agriculture/foundational_axioms.json'
                ]
            ],
            69 => [
                'name' => 'Library & Information Science, Bibliometrics & Curation',
                'files' => [
                    'humanities/information_science/foundational_axioms.json'
                ]
            ],
            70 => [
                'name' => 'Aviation, Marine Navigation & Nautics',
                'files' => [
                    'applied_science/navigation/foundational_axioms.json'
                ]
            ],
            71 => [
                'name' => 'Disaster Science, Emergency Management & Risk Resilience',
                'files' => [
                    'social_science/disaster_science/foundational_axioms.json'
                ]
            ],
            72 => [
                'name' => 'Public Administration, Public Policy & Bureaucracy',
                'files' => [
                    'social_science/public_policy/foundational_axioms.json'
                ]
            ],
            73 => [
                'name' => 'Critical Theory, Post-structuralism & Deconstruction',
                'files' => [
                    'humanities/critical_theory/foundational_axioms.json'
                ]
            ],
            74 => [
                'name' => 'Gender Studies, Queer Theory & Intersectionality',
                'files' => [
                    'humanities/gender_studies/foundational_axioms.json'
                ]
            ],
            75 => [
                'name' => 'Game Design, Ludology & Play Theory',
                'files' => [
                    'arts/ludology/foundational_axioms.json'
                ]
            ],
            76 => [
                'name' => 'Penology, Correctional Science & Restorative Justice',
                'files' => [
                    'social_science/penology/foundational_axioms.json'
                ]
            ],
            77 => [
                'name' => 'Translation Studies & Rhetoric',
                'files' => [
                    'humanities/translation_theory/foundational_axioms.json'
                ]
            ],
            78 => [
                'name' => 'Leisure, Hospitality & Tourism Management',
                'files' => [
                    'business/tourism/foundational_axioms.json'
                ]
            ],
            79 => [
                'name' => 'Divination Systems & Historical Esoteric Cosmologies',
                'files' => [
                    'humanities/divination_systems/foundational_axioms.json'
                ]
            ],
            80 => [
                'name' => 'Zmzir Unified Dialectical Metatheory (Epistemic Absolute)',
                'files' => [
                    'formal_logic/zmzir_metatheory/foundational_axioms.json'
                ]
            ],
            81 => [
                'name' => 'Visual & Graphic Arts',
                'files' => [
                    'arts/visual_arts/foundational_axioms.json'
                ]
            ],
            82 => [
                'name' => 'Performing Arts & Cinema',
                'files' => [
                    'arts/performing_arts/foundational_axioms.json'
                ]
            ],
            83 => [
                'name' => 'Specialized Clinical Medicine',
                'files' => [
                    'medicine/specialized_clinical/foundational_axioms.json'
                ]
            ],
            84 => [
                'name' => 'Traditional & Alternative Medicine',
                'files' => [
                    'medicine/alternative_medicine/foundational_axioms.json'
                ]
            ],
            85 => [
                'name' => 'Advanced Biological Sub-disciplines',
                'files' => [
                    'biology/advanced_subdisciplines/foundational_axioms.json'
                ]
            ],
            86 => [
                'name' => 'Specialized Engineering',
                'files' => [
                    'engineering/specialized_engineering/foundational_axioms.json'
                ]
            ],
            87 => [
                'name' => 'Linguistics Subfields',
                'files' => [
                    'humanities/linguistics_subfields/foundational_axioms.json'
                ]
            ],
            88 => [
                'name' => 'Journalism, Mass Media & Public Relations',
                'files' => [
                    'interdisciplinary/journalism_media/foundational_axioms.json'
                ]
            ],
            89 => [
                'name' => 'Business Niches',
                'files' => [
                    'business/specialized_niches/foundational_axioms.json'
                ]
            ],
            90 => [
                'name' => 'Domestic & Consumer Sciences',
                'files' => [
                    'applied_science/domestic_sciences/foundational_axioms.json'
                ]
            ],
            91 => [
                'name' => 'Specialized Legal Fields',
                'files' => [
                    'social_science/specialized_law/foundational_axioms.json'
                ]
            ],
            92 => [
                'name' => 'Psychology Branches',
                'files' => [
                    'social_science/psychology_branches/foundational_axioms.json'
                ]
            ],
            93 => [
                'name' => 'Area & Cultural Studies',
                'files' => [
                    'humanities/area_cultural_studies/foundational_axioms.json'
                ]
            ],
            94 => [
                'name' => 'Deep Computer Science Branches',
                'files' => [
                    'computer_science/deep_branches/foundational_axioms.json'
                ]
            ],
            95 => [
                'name' => 'Specialized Agriculture & Husbandry',
                'files' => [
                    'biology/specialized_agriculture/foundational_axioms.json'
                ]
            ],
            96 => [
                'name' => 'Transportation & Infrastructure',
                'files' => [
                    'engineering/transportation/foundational_axioms.json'
                ]
            ],
            97 => [
                'name' => 'Speleology, Pedology & Extreme Earth Sciences',
                'files' => [
                    'earth_science/extreme_earth_sciences/foundational_axioms.json'
                ]
            ],
            98 => [
                'name' => 'Esoteric Philosophy & Movements',
                'files' => [
                    'humanities/esoteric_philosophy/foundational_axioms.json'
                ]
            ],
            99 => [
                'name' => 'Biophysics & Synthetic Biology',
                'files' => [
                    'biology/biophysics_synthetic/foundational_axioms.json'
                ]
            ],
            100 => [
                'name' => 'Absolute Epistemic Synthesis',
                'files' => [
                    'formal_logic/absolute_synthesis/foundational_axioms.json'
                ]
            ],
            101 => [
                'name' => 'Eastern Epistemology & Non-Dualism',
                'files' => [
                    'philosophy/eastern_epistemology/foundational_axioms.json'
                ]
            ],
            102 => [
                'name' => 'Indigenous Knowledge Systems & Ethnoscience',
                'files' => [
                    'anthropology/indigenous_knowledge/foundational_axioms.json'
                ]
            ],
            103 => [
                'name' => 'AI Alignment & Machine Learning',
                'files' => [
                    'computer_science/ai_alignment/foundational_axioms.json'
                ]
            ],
            104 => [
                'name' => 'Quantum Information Science',
                'files' => [
                    'physics/quantum_information/foundational_axioms.json'
                ]
            ],
            105 => [
                'name' => 'Blockchain & Decentralized Consensus',
                'files' => [
                    'computer_science/decentralized_consensus/foundational_axioms.json'
                ]
            ],
            106 => [
                'name' => 'Cybersecurity & Cryptanalysis',
                'files' => [
                    'computer_science/cybersecurity/foundational_axioms.json'
                ]
            ],
            107 => [
                'name' => 'Anthropocene & Sustainability',
                'files' => [
                    'earth_science/anthropocene_sustainability/foundational_axioms.json'
                ]
            ],
            108 => [
                'name' => 'Phenomenology & Existentialism',
                'files' => [
                    'humanities/phenomenology/foundational_axioms.json'
                ]
            ],
            109 => [
                'name' => 'Neurodiversity & Cognitive Pluralism',
                'files' => [
                    'social_science/neurodiversity/foundational_axioms.json'
                ]
            ],
            110 => [
                'name' => 'Astro-Sociology & Interplanetary Expansion',
                'files' => [
                    'interdisciplinary/astro_sociology/foundational_axioms.json'
                ]
            ],
            111 => [
                'name' => 'Xenology & Exo-Sociology',
                'files' => [
                    'interdisciplinary/xenology/foundational_axioms.json'
                ]
            ],
            112 => [
                'name' => 'Post-Human & Transhumanist Ethics',
                'files' => [
                    'philosophy/transhumanist_ethics/foundational_axioms.json'
                ]
            ],
            113 => [
                'name' => 'Speculative Multiversal Economics',
                'files' => [
                    'social_science/multiversal_economics/foundational_axioms.json'
                ]
            ],
            114 => [
                'name' => 'Chrono-Mechanics & Temporal Engineering',
                'files' => [
                    'physics/chrono_mechanics/foundational_axioms.json'
                ]
            ],
            115 => [
                'name' => 'Synthetic Biology & Xenobotany',
                'files' => [
                    'biology/synthetic_biology/foundational_axioms.json'
                ]
            ],
            116 => [
                'name' => 'Simulation Hypothesis Metaphysics',
                'files' => [
                    'philosophy/simulation_metaphysics/foundational_axioms.json'
                ]
            ],
            117 => [
                'name' => 'Quantum Consciousness & Panpsychism',
                'files' => [
                    'interdisciplinary/quantum_consciousness/foundational_axioms.json'
                ]
            ],
            118 => [
                'name' => 'Megastructure & Astro-Engineering',
                'files' => [
                    'engineering/astro_engineering/foundational_axioms.json'
                ]
            ],
            119 => [
                'name' => 'Esoteric Hyper-Mathematics',
                'files' => [
                    'formal_logic/hyper_mathematics/foundational_axioms.json'
                ]
            ],
            120 => [
                'name' => 'The Omega-Point Synthesis (The Ultimate Axioms)',
                'files' => [
                    'formal_logic/omega_point/foundational_axioms.json'
                ]
            ]
        ];

        // 2. Unconditionally seed/update Absolute Roots (Fragment 1)
        $this->seedAbsoluteRoots();

        // 3. Evaluate Environment variable parameters (SEED_FRAGMENT and UP_TO_FRAGMENT)
        $seedSingle = getenv('SEED_FRAGMENT');
        $upTo = getenv('UP_TO_FRAGMENT');

        $activeFragments = [];
        if ($seedSingle !== false && $seedSingle !== '') {
            $fragIndex = (int) $seedSingle;
            if (isset($fragments[$fragIndex])) {
                $activeFragments[$fragIndex] = $fragments[$fragIndex];
            } else {
                throw new \InvalidArgumentException("Invalid SEED_FRAGMENT value: {$fragIndex}");
            }
        } elseif ($upTo !== false && $upTo !== '') {
            $maxIndex = (int) $upTo;
            foreach ($fragments as $idx => $frag) {
                if ($idx <= $maxIndex) {
                    $activeFragments[$idx] = $frag;
                }
            }
        } else {
            // Seed all fragments by default
            $activeFragments = $fragments;
        }

        // 4. Data Ingestion (Pass 2)
        $dataDir = database_path('data');
        $allAxiomsMap = []; // child_sig -> ['parent_thesis' => parent_thesis, 'domain_partition' => domain_partition]

        foreach ($activeFragments as $idx => $fragment) {
            if ($idx === 1)
                continue; // Roots statically seeded

            $this->command->info("=== Seeding Fragment {$idx}: {$fragment['name']} ===");

            foreach ($fragment['files'] as $relativePath) {
                $filePath = $dataDir . '/' . $relativePath;
                if (!file_exists($filePath)) {
                    $this->command->warn("  [Warning] File not found: {$relativePath}");
                    continue;
                }

                $jsonData = json_decode(file_get_contents($filePath), true);
                if ($jsonData === null) {
                    $this->command->error("  [Error] Invalid JSON syntax in file: {$relativePath}");
                    continue;
                }

                $fileCount = 0;
                foreach ($jsonData as $item) {
                    $thesis = trim($item['thesis_statement'] ?? '');
                    if ($thesis === '')
                        continue;

                    // Unified AST signature calculation
                    $cleanThesis = trim(str_ireplace('prove: ', '', strtolower($thesis)));
                    $astSignature = hash('sha256', $cleanThesis);

                    $axiomData = [
                        'branch' => $item['branch'] ?? 'general_knowledge',
                        'domain_partition' => $item['domain_partition'] ?? 'general_partition',
                        'thesis_statement' => $thesis,
                        'formal_proof' => $item['formal_proof'] ?? null,
                        'context_description' => $item['context_description'] ?? null,
                        'ast_signature' => $astSignature,
                        'parent_axiom_id' => null, // 1st pass: Null to prevent FK constraint failures
                        'status' => 'global_axiom',
                        'expert_review_required' => $item['expert_review_required'] ?? false,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];

                    // Capture parent links
                    $parentThesis = trim($item['parent_thesis'] ?? '');
                    if ($parentThesis !== '') {
                        $allAxiomsMap[$astSignature] = [
                            'parent_thesis' => $parentThesis,
                            'domain_partition' => $axiomData['domain_partition']
                        ];
                    }

                    // Update or Insert into DB
                    DB::table('knowledge_axioms')->updateOrInsert(
                        ['ast_signature' => $astSignature, 'domain_partition' => $axiomData['domain_partition']],
                        $axiomData
                    );
                    $fileCount++;
                }
                $this->command->line("  Processed {$fileCount} axioms from: {$relativePath}");
            }
        }

        // 5. Relationship Binding (Pass 3)
        $this->command->info("=== Resolving child-parent relationships ===");
        $resolvedCount = 0;

        foreach ($allAxiomsMap as $childSig => $parentInfo) {
            $parentThesis = $parentInfo['parent_thesis'];

            // Normalize parent thesis to compute its signature
            $cleanParent = trim(str_ireplace('prove: ', '', strtolower($parentThesis)));
            $parentSig = hash('sha256', $cleanParent);

            // Look up parent by normalized signature
            $parent = DB::table('knowledge_axioms')
                ->where('ast_signature', $parentSig)
                ->first();

            if ($parent) {
                DB::table('knowledge_axioms')
                    ->where('ast_signature', $childSig)
                    ->update(['parent_axiom_id' => $parent->id]);
                $resolvedCount++;
            } else {
                // Direct fallback matching
                $parentFallback = DB::table('knowledge_axioms')
                    ->where('thesis_statement', $parentThesis)
                    ->first();

                if ($parentFallback) {
                    DB::table('knowledge_axioms')
                        ->where('ast_signature', $childSig)
                        ->update(['parent_axiom_id' => $parentFallback->id]);
                    $resolvedCount++;
                } else {
                    $this->command->line("  Parent not found for: {$childSig} -> '{$parentThesis}' (Could be in a future fragment)");
                }
            }
        }
        $this->command->info("Bound {$resolvedCount} child-parent relationships.");

        // 6. Post-Seed Pedigree Verification Sweep (Pass 4)
        $this->command->info("=== Running Pedigree Integrity Verification ===");
        $allAxioms = DB::table('knowledge_axioms')->get();
        $warnings = [];

        foreach ($allAxioms as $axiom) {
            if ($axiom->id == 1 || $axiom->id == 2) {
                continue; // Statically validated roots
            }

            $path = [];
            $visited = [];
            $currentId = $axiom->id;
            $isValid = false;

            while ($currentId !== null) {
                $path[] = $currentId;

                if ($currentId == 1 || $currentId == 2) {
                    $isValid = true;
                    break;
                }

                if (in_array($currentId, $visited)) {
                    $warnings[] = "Cycle detected for Axiom #{$axiom->id} ('{$axiom->thesis_statement}'). Path: " . implode(" -> ", $path);
                    break;
                }
                $visited[] = $currentId;

                $parent = DB::table('knowledge_axioms')->where('id', $currentId)->first();
                if (!$parent || !$parent->parent_axiom_id) {
                    break;
                }
                $currentId = $parent->parent_axiom_id;
            }

            if (!$isValid) {
                // If it is in the active seeding map, it is an actual orphan warning
                if (isset($allAxiomsMap[$axiom->ast_signature])) {
                    $warnings[] = "Axiom #{$axiom->id} ('{$axiom->thesis_statement}') is unanchored (does not trace back to Absolute Root 1 or 2).";
                }
            }
        }

        if (count($warnings) > 0) {
            $this->command->warn("Pedigree verification completed with " . count($warnings) . " warnings:");
            foreach ($warnings as $warn) {
                $this->command->warn("  [Integrity Alert] " . $warn);
            }
        } else {
            $this->command->info("Pedigree verification completed successfully. 100% of seeded axioms trace back to Absolute Roots.");
        }

        // 7. Auto-delete ML semantic cache on success to trigger dynamic retraining
        $modelPath = storage_path('app/dialectical_semantic_model.bin');
        if (file_exists($modelPath)) {
            unlink($modelPath);
            $this->command->info("Cleared local ML cache file: dialectical_semantic_model.bin");
        }
    }

    private function seedAbsoluteRoots(): void
    {
        DB::table('knowledge_axioms')->updateOrInsert(
            ['id' => 1],
            [
                'branch' => 'absolute',
                'domain_partition' => 'cpu_root',
                'thesis_statement' => '0: Nothing (False)',
                'ast_signature' => hash('sha256', '0: nothing (false)'),
                'parent_axiom_id' => null,
                'status' => 'global_axiom',
                'expert_review_required' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        DB::table('knowledge_axioms')->updateOrInsert(
            ['id' => 2],
            [
                'branch' => 'absolute',
                'domain_partition' => 'cpu_root',
                'thesis_statement' => '1: Being (True)',
                'ast_signature' => hash('sha256', '1: being (true)'),
                'parent_axiom_id' => null,
                'status' => 'global_axiom',
                'expert_review_required' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }
}