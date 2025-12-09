import wikipediaapi
import json
import os
import time
from typing import List, Set
import re

class WikipediaEnricher:
    def __init__(self):
        self.wiki = wikipediaapi.Wikipedia(
            user_agent='MyChatbot/1.0 (contact@example.com)',
            language='en',
            extract_format=wikipediaapi.ExtractFormat.WIKI
        )
        self.added_count = 0
        self.error_count = 0
    
    def get_extensive_topics(self) -> List[str]:
        """Get a much more extensive list of topics"""
        categories = {
            "Science": [
                "Physics", "Chemistry", "Biology", "Astronomy", "Geology", 
                "Mathematics", "Computer Science", "Engineering", "Medicine",
                "Neuroscience", "Psychology", "Sociology", "Anthropology",
                "Economics", "Political Science", "Environmental Science"
            ],
            "Technology": [
                "Artificial Intelligence", "Machine Learning", "Deep Learning",
                "Robotics", "Cybersecurity", "Data Science", "Cloud Computing",
                "Internet", "Blockchain", "Cryptocurrency", "Virtual Reality",
                "Augmented Reality", "Quantum Computing", "Nanotechnology",
                "Biotechnology", "Renewable Energy", "Space Technology"
            ],
            "History": [
                "World History", "Ancient History", "Middle Ages", 
                "Renaissance", "Industrial Revolution", "World War I",
                "World War II", "Cold War", "Modern History"
            ],
            "Arts": [
                "Literature", "Music", "Visual Arts", "Film", "Theatre",
                "Architecture", "Photography", "Dance"
            ],
            "Philosophy": [
                "Ethics", "Logic", "Metaphysics", "Epistemology",
                "Political Philosophy", "Aesthetics"
            ],
            "Geography": [
                "Countries", "Cities", "Oceans", "Mountains", "Rivers",
                "Climate", "Ecosystems", "Natural Resources"
            ]
        }
        
        # Flatten the categories
        all_topics = []
        for category_topics in categories.values():
            all_topics.extend(category_topics)
        
        return all_topics
    
    def get_wikipedia_categories(self) -> List[str]:
        """Get topics from Wikipedia categories"""
        # These are Wikipedia category names
        return [
            # SCIENCE & STEM
            "Category:Science",
            "Category:Natural_sciences",
            "Category:Physical_sciences",
            "Category:Formal_sciences",
            "Category:Applied_sciences",
            "Category:STEM_fields",
            "Category:Mathematics",
            "Category:Pure_mathematics",
            "Category:Applied_mathematics",
            "Category:Statistics",
            "Category:Probability",
            "Category:Logic",

            # COMPUTER SCIENCE & IT
            "Category:Computer_science",
            "Category:Information_technology",
            "Category:Software_engineering",
            "Category:Programming_languages",
            "Category:Operating_systems",
            "Category:Algorithms",
            "Category:Data_structures",
            "Category:Computer_networking",
            "Category:Internet",
            "Category:Web_development",
            "Category:Mobile_development",

            # ARTIFICIAL INTELLIGENCE
            "Category:Artificial_intelligence",
            "Category:Machine_learning",
            "Category:Deep_learning",
            "Category:Neural_networks",
            "Category:NLP",
            "Category:Computer_vision",
            "Category:Robotics",
            "Category:Automation",

            # DATA & CYBER
            "Category:Data_science",
            "Category:Big_data",
            "Category:Data_mining",
            "Category:Databases",
            "Category:Cloud_computing",
            "Category:Cybersecurity",
            "Category:Cryptography",
            "Category:Blockchain",
            "Category:Cryptocurrency",

            # ENGINEERING
            "Category:Engineering",
            "Category:Electrical_engineering",
            "Category:Mechanical_engineering",
            "Category:Civil_engineering",
            "Category:Chemical_engineering",
            "Category:Aerospace_engineering",
            "Category:Biomedical_engineering",
            "Category:Software_engineering",
            "Category:Materials_science",

            # ENERGY & ENVIRONMENT
            "Category:Energy",
            "Category:Renewable_energy",
            "Category:Sustainable_energy",
            "Category:Climate_change",
            "Category:Environmental_science",
            "Category:Conservation",
            "Category:Pollution",
            "Category:Ecology",
            "Category:Earth_sciences",
            "Category:Geology",
            "Category:Meteorology",
            "Category:Hydrology",
            "Category:Oceanography",

            # SPACE & ASTRONOMY
            "Category:Astronomy",
            "Category:Astrophysics",
            "Category:Cosmology",
            "Category:Space_exploration",
            "Category:Planetary_science",

            # BIOLOGY & LIFE SCIENCES
            "Category:Biology",
            "Category:Genetics",
            "Category:Microbiology",
            "Category:Zoology",
            "Category:Botany",
            "Category:Biotechnology",
            "Category:Neuroscience",
            "Category:Evolutionary_biology",

            # HEALTH & MEDICINE
            "Category:Medicine",
            "Category:Health_sciences",
            "Category:Public_health",
            "Category:Pharmacology",
            "Category:Pathology",
            "Category:Psychiatry",
            "Category:Psychology",
            "Category:Surgery",
            "Category:Nutrition",

            # SOCIAL SCIENCES
            "Category:Social_sciences",
            "Category:Anthropology",
            "Category:Sociology",
            "Category:Political_science",
            "Category:Economics",
            "Category:International_relations",
            "Category:Linguistics",
            "Category:Human_geography",
            "Category:Education",
            "Category:Law",
            "Category:Criminology",
            "Category:Demography",

            # HUMANITIES
            "Category:Humanities",
            "Category:History",
            "Category:Philosophy",
            "Category:Ethics",
            "Category:Logic",
            "Category:Religion",
            "Category:Theology",
            "Category:Literature",
            "Category:Linguistics",
            "Category:Languages",

            # ARTS & CULTURE
            "Category:Arts",
            "Category:Visual_arts",
            "Category:Fine_art",
            "Category:Painting",
            "Category:Sculpture",
            "Category:Drawing",
            "Category:Photography",
            "Category:Cinema",
            "Category:Film",
            "Category:Television",
            "Category:Theatre",
            "Category:Music",
            "Category:Dance",
            "Category:Architecture",
            "Category:Design",
            "Category:Graphic_design",
            "Category:Fashion",

            # BUSINESS & ECONOMICS
            "Category:Business",
            "Category:Finance",
            "Category:Banking",
            "Category:Accounting",
            "Category:Marketing",
            "Category:Management",
            "Category:Entrepreneurship",
            "Category:Economics",
            "Category:International_business",
            "Category:Supply_chain_management",

            # GEOGRAPHY
            "Category:Geography",
            "Category:Physical_geography",
            "Category:Human_geography",
            "Category:Urban_studies",
            "Category:Cartography",
            "Category:Geopolitics",

            # HISTORY CATEGORIES
            "Category:Ancient_history",
            "Category:Medieval_history",
            "Category:Modern_history",
            "Category:Contemporary_history",
            "Category:World_history",
            "Category:Military_history",

            # CULTURE / SOCIETY
            "Category:Culture",
            "Category:Popular_culture",
            "Category:Mass_media",
            "Category:Communication",
            "Category:Journalism",
            "Category:Folklore",

            # LANGUAGES
            "Category:Languages",
            "Category:Translation",
            "Category:Linguistics",
            "Category:Writing_systems",

            # TECHNOLOGY FRONTIER
            "Category:Quantum_computing",
            "Category:Nanotechnology",
            "Category:Bioinformatics",
            "Category:Human_computer_interaction",
            "Category:Virtual_reality",
            "Category:Augmented_reality",
            "Category:Digital_transformation",
            "Category:3D_printing",
            "Category:Smart_cities",
            "Category:IoT",
            "Category:Wearable_technology",
            "Category:Autonomous_vehicles"
        ]

    def clean_text(self, text: str, max_length: int = 20000) -> str:
        """Clean Wikipedia text"""
        # Remove citations like [1], [2], etc.
        text = re.sub(r'\[\d+\]', '', text)
        # Remove multiple spaces
        text = re.sub(r'\s+', ' ', text)
        # Truncate if too long
        if len(text) > max_length:
            # Try to cut at sentence end
            sentences = text.split('. ')
            result = []
            total_length = 0
            for sentence in sentences:
                if total_length + len(sentence) < max_length - 3:  # Reserve for "..."
                    result.append(sentence)
                    total_length += len(sentence) + 1  # +1 for period
                else:
                    break
            text = '. '.join(result) + '...'
        return text.strip()
    
    def enrich_from_list(self, topics: List[str], max_articles: int = 1500) -> int:
        """Enrich from a list of topics"""
        if os.path.exists("knowledge.json"):
            with open("knowledge.json", "r", encoding="utf-8") as f:
                knowledge_base = json.load(f)
        else:
            knowledge_base = []
        
        existing_sources = {item['source'] for item in knowledge_base}
        added = 0
        
        for topic in topics:
            if self.added_count >= max_articles:
                break
                
            source_id = f"wikipedia-{topic.replace(' ', '-').replace('_', '-').lower()}"
            if source_id in existing_sources:
                continue
            
            print(f"Fetching: {topic}")
            page = self.wiki.page(topic)
            
            if page.exists() and page.summary:
                try:
                    summary = self.clean_text(page.summary, 400)
                    
                    knowledge_base.append({
                        "text": summary,
                        "source": source_id
                    })
                    
                    existing_sources.add(source_id)
                    self.added_count += 1
                    added += 1
                    
                    print(f"✓ Added: {topic}")
                    time.sleep(0.5)  # Be nice to Wikipedia API
                    
                except Exception as e:
                    print(f"✗ Error processing {topic}: {e}")
                    self.error_count += 1
            else:
                print(f"✗ Not found: {topic}")
        
        # Save after each batch
        with open("knowledge.json", "w", encoding="utf-8") as f:
            json.dump(knowledge_base, f, indent=2, ensure_ascii=False)
        
        return added
    
    def enrich_knowledge_comprehensive(self, max_total: int = 1500):
        """Comprehensive knowledge enrichment"""
        print("Starting comprehensive Wikipedia enrichment...")
        
        # Start with basic topics
        basic_topics = self.get_extensive_topics()
        print(f"Phase 1: Adding {len(basic_topics)} basic topics...")
        self.enrich_from_list(basic_topics, max_total)
        
        print(f"\nPhase 1 complete. Added {self.added_count} articles.")
        
        # Try to get more from categories
        if self.added_count < max_total:
            print("\nPhase 2: Exploring Wikipedia categories...")
            categories = self.get_wikipedia_categories()
            
            for category in categories:
                if self.added_count >= max_total:
                    break
                    
                print(f"Exploring category: {category}")
                cat_page = self.wiki.page(category)
                
                if cat_page.exists() and hasattr(cat_page, 'categorymembers'):
                    # Get first 20 members of this category
                    members = list(cat_page.categorymembers.values())[:20]
                    member_titles = [m.title for m in members]
                    
                    added = self.enrich_from_list(member_titles, max_total - self.added_count)
                    print(f"  Added {added} from {category}")
                    time.sleep(1)  # Longer delay between categories
        
        print(f"\n=== ENRICHMENT COMPLETE ===")
        print(f"Total articles added: {self.added_count}")
        print(f"Total errors: {self.error_count}")
        
        if os.path.exists("knowledge.json"):
            with open("knowledge.json", "r", encoding="utf-8") as f:
                final_kb = json.load(f)
            print(f"Final knowledge base size: {len(final_kb)} entries")
        self.enrich_more_topics()
        return self.added_count

    # ====================== EXTENDED ENRICHER ======================

    wiki = wikipediaapi.Wikipedia(
            user_agent='MyChatbot/1.0 (contact@example.com)',
            language='en',
            extract_format=wikipediaapi.ExtractFormat.WIKI
    )

    def enrich_more_topics(start_topics: List[str], depth: int = 2) -> List[dict]:
        """Recursive fetch: Start from topics, get linked pages"""
        new_docs = []
        visited = set()
        
        def fetch_recursive(topic: str, current_depth: int):
            if current_depth > depth or topic in visited:
                return
            visited.add(topic)
            
            try:
                page = wiki.page(topic)
                if page.exists():
                    text = page.text[:2000]  # Limit size
                    source = f"wikipedia-{topic.lower().replace(' ', '-')}"
                    new_docs.append({"text": text, "source": source})
                    
                    # Get links for recursion
                    links = list(page.links.keys())[:10]  # Top 10 links
                    for link in links:
                        fetch_recursive(link, current_depth + 1)
            except Exception as e:
                print(f"Error fetching {topic}: {e}")
        
        for start in start_topics:
            fetch_recursive(start, 0)
        
        return new_docs

    # Usage: Add to your main enrich function
    additional_topics = [
        "Acoustic Engineering", "Acoustics", "Actuarial Science", "Adaptive Systems",
        "Additive Manufacturing", "Aerial Robotics", "Affective Computing",
        "Agricultural Economics", "Agricultural Engineering", "Agronomy",
        "Air Quality", "Algebraic Geometry", "Algebraic Topology", "Algorithmic Game Theory",
        "Algorithmic Trading", "Alternative Medicine", "Analytical Chemistry",
        "Anatomical Sciences", "Ancient Civilizations", "Animal Behavior",
        "Animal Genetics", "Animation", "Anthropogenic Climate Change",
        "Antibody Engineering", "Antimatter Research", "Applied Cryptography",
        "Applied Economics", "Applied Ethics", "Applied Linguistics",
        "Applied Optics", "Applied Physics", "Aquaculture", "Aquatic Toxicology",
        "Archaeological Science", "Archaeometry", "Archival Science",
        "Artificial Life", "Artificial Organs", "Astrobiology",
        "Astronautics", "Atmospheric Chemistry", "Atmospheric Physics",
        "Audio Engineering", "Augmented Biology", "Autonomous Robotics",
        "Aviation Technology", "Behavioral Economics", "Behavioral Neuroscience",
        "Behavioral Science", "Bioacoustics", "Bioanthropology", "Biochemical Engineering",
        "Biochemistry", "Bioeconomics", "Bioethics", "Biofuels", "Bioimage Analysis",
        "Bioinorganic Chemistry", "Bioinstrumentation", "Biolinguistics",
        "Biomaterials", "Biomechanics", "Biomedical Imaging", "Biomedical Informatics",
        "Biomedical Optics", "Biomedical Robotics", "Biomimetics",
        "Biopharmaceuticals", "Biophysics", "Bioprocess Engineering",
        "Biopsychology", "Bioreactors", "Biosensors", "Biostatistics",
        "Biotechnology Policy", "Blue Economy", "Brain_Computer Interfaces",
        "Building Engineering", "Cancer Biology", "Cancer Genomics",
        "Cancer Immunotherapy", "Carbon Capture", "Cartooning",
        "Catalysis Science", "Cell Biology", "Cellular Automata", "Ceramic Engineering",
        "Chemical Biology", "Chemical Physics", "Children's Literature",
        "Chromatography", "Cinematography", "Civil Liberties", "Climate Modeling",
        "Clinical Nutrition", "Clinical Psychology", "Cognitive Biology",
        "Cognitive Linguistics", "Cognitive Neuroscience", "Cognitive Psychology",
        "Cognitive Robotics", "Color Theory", "Combinatorics",
        "Commercial Law", "Comparative Anatomy", "Comparative Literature",
        "Comparative Politics", "Computational Biology", "Computational Chemistry",
        "Computational Geometry", "Computational Linguistics",
        "Computational Mathematics", "Computational Mechanics",
        "Computational Neuroscience", "Computational Sociology",
        "Computer Architecture", "Computer Graphics", "Computer Music",
        "Computing Education", "Condensed Matter Physics", "Conflict Studies",
        "Consciousness Studies", "Construction Engineering",
        "Consumer Behavior", "Control Systems", "Coral Reef Ecology",
        "Corporate Governance", "Corporate Law", "Creativity Studies",
        "Criminal Law", "Critical Theory", "Cryptanalysis",
        "Cultural Anthropology", "Cultural Geography", "Cultural Heritage",
        "Cultural Psychology", "Curatorial Studies", "Cyber Law",
        "Cyber-Physical Systems", "Data Ethics", "Data Governance",
        "Data Journalism", "Decision Theory", "Deep Ocean Exploration",
        "Democratic Theory", "Desalination", "Design Theory",
        "Development Economics", "Development Studies", "Digital Anthropology",
        "Digital Archaeology", "Digital Ethics", "Digital Finance",
        "Digital Governance", "Digital Humanities", "Digital Law",
        "Digital Logic Design", "Digital Psychology", "Disaster Management",
        "Distributed Systems", "Drug Discovery", "Earth Observation",
        "Earthquake Engineering", "Eastern Philosophy", "Economic Geography",
        "Economic Policy", "Econometrics", "Education Policy",
        "Effects Processing", "Electrochemistry", "Electromagnetics",
        "Electron Microscopy", "Electronics Engineering",
        "Embedded Systems", "Emerging Technologies", "Emotion AI",
        "Endocrinology", "Energy Economics", "Energy Engineering",
        "Energy Policy", "Engineering Ethics", "Engineering Mathematics",
        "Engineering Management", "Engineering Physics", "Entomology",
        "Entrepreneurial Finance", "Environmental Chemistry",
        "Environmental Economics", "Environmental Engineering",
        "Environmental Law", "Environmental Microbiology",
        "Environmental Policy", "Environmental Psychology",
        "Epidemiology", "Epigenetics", "Ethnomusicology",
        "Ethnopharmacology", "Ethnography", "European History",
        "Evolutionary Linguistics", "Evolutionary Psychology",
        "Experimental Archaeology", "Experimental Physics",
        "Farm Management", "Fashion History", "Fiber Optics",
        "Financial Engineering", "Financial Mathematics",
        "Fire Science", "Fishery Science", "Fluid Mechanics",
        "Food Engineering", "Food Microbiology", "Food Safety",
        "Food Technology", "Forest Ecology", "Forest Engineering",
        "Forensic Anthropology", "Forensic Medicine", "Forensic Psychology",
        "Forensic Science", "Formal Epistemology",
        "Fracture Mechanics", "Game Design", "Game Studies",
        "Gas Dynamics", "Gender Studies", "Gene Therapy",
        "Geoarchaeology", "Geochemistry", "Geodesy", "Geoengineering",
        "Geomatics", "Geomorphology", "Geophysics", "Gerontology",
        "Global Health", "Globalization Studies", "Governance Studies",
        "Graphic Storytelling", "Green Chemistry", "Green Engineering",
        "Health Economics", "Health Engineering", "Health Informatics",
        "Herpetology", "High-Energy Physics", "High-Performance Computing",
        "Histology", "History of Mathematics", "History of Medicine",
        "History of Technology", "Human Anatomy", "Human Biology",
        "Human Development", "Human Factors Engineering",
        "Human Genetics", "Human Rights Law", "Human_Robot Interaction",
        "Hydrogeology", "Hydrology", "Hydropower", "Iberian Studies",
        "Immunology", "Industrial Chemistry", "Industrial Design",
        "Industrial Economics", "Industrial Engineering", "Infectious Diseases",
        "Information Architecture", "Information Ethics",
        "Information Governance", "Information Management",
        "Infrared Astronomy", "Inorganic Chemistry", "Insect Ecology",
        "Instructional Design", "Intellectual History", "Intellectual Property Law",
        "Intelligence Studies", "Intercultural Communication",
        "Interface Design", "International Development",
        "International Economics", "International Law",
        "International Security", "Internet Governance",
        "Invertebrate Zoology", "Landscape Ecology", "Laser Technology",
        "Latin American Studies", "Leadership Studies",
        "Learning Sciences", "Legal Theory", "Lepidopterology",
        "Liberal Studies", "Library Science", "Life Coaching",
        "Lipidomics", "Literary Criticism", "Literary Theory",
        "Livestock Science", "Machine Ethics", "Machine Perception",
        "Macroeconomics", "Magnetism", "Mammalogy", "Maritime Studies",
        "Marketing Analytics", "Materials Chemistry",
        "Materials Engineering", "Materials Physics",
        "Mathematical Biology", "Mathematical Logic",
        "Mathematical Physics", "Measurement Science",
        "Medical Anthropology", "Medical Biochemistry",
        "Medical Biotechnology", "Medical Engineering",
        "Medical Humanities", "Medical Imaging",
        "Medical Informatics", "Medical Robotics",
        "Medicinal Chemistry", "Medieval Literature",
        "Membrane Technology", "Mental Health Education",
        "Metabolic Engineering", "Metallurgy", "Metaphysics",
        "Microelectronics", "Microfluidics", "Microscopy",
        "Middle Eastern Studies", "Military Ethics",
        "Mineralogy", "Molecular Biology", "Molecular Genetics",
        "Molecular Medicine", "Molecular Physics",
        "Molecular Robotics", "Morphology", "Museum Studies",
        "Music Production", "Music Theory", "Mycology",
        "Nanobiotechnology", "Nanomedicine", "Nanophysics",
        "Natural Language Generation", "Natural Resource Economics",
        "Natural Resource Management", "Naval Engineering",
        "Nephrology", "Network Science", "Neuroeconomics",
        "Neuroengineering", "Neuroethics", "Neurogenetics",
        "Neuromarketing", "Neuromorphic Computing",
        "Neuropharmacology", "Neurophysiology",
        "New Media Art", "Nuclear Chemistry", "Nuclear Engineering",
        "Nuclear Medicine", "Numerical Analysis", "Nutritional Science",
        "Ocean Literacy", "Ocean Technology", "Ophthalmology",
        "Optical Physics", "Optoelectronics", "Orbital Mechanics",
        "Organic Chemistry", "Organizational Behavior",
        "Organizational Psychology", "Paleobiology", "Paleoclimatology",
        "Paleontology", "Parasitology", "Particle Physics",
        "Peace Studies", "Pedagogy", "Petroleum Engineering",
        "Pharmaceutical Engineering", "Pharmacogenomics",
        "Pharmacognosy", "Pharmacokinetics", "Pharmacology",
        "Philosophy of Mind", "Philosophy of Science",
        "Phonetics", "Phonology", "Photochemistry",
        "Photonic Engineering", "Physical Chemistry",
        "Physical Oceanography", "Planetary Geology",
        "Plant Biology", "Plant Physiology", "Plasma Physics",
        "Political Economy", "Political Geography",
        "Political Philosophy", "Polymer Chemistry",
        "Polymer Engineering", "Population Biology",
        "Population Genetics", "Postcolonial Studies",
        "Power Engineering", "Precision Agriculture",
        "Programming Theory", "Propulsion Engineering",
        "Protozoology", "Public Finance", "Public Policy",
        "Public Sociology", "Quantum Biology", "Quantum Cryptography",
        "Quantum Materials", "Quantum Optics", "Quantum Sensors",
        "Queer Studies", "Radar Engineering", "Radiation Biology",
        "Radiation Physics", "Radio Astronomy", "Reaction Engineering",
        "Real Analysis", "Reconstruction Archaeology",
        "Recycling Technology", "Regional Economics",
        "Rehabilitation Engineering", "Remote Sensing",
        "Renewable Materials", "Reproductive Biology",
        "Risk Analysis", "Risk Management", "River Ecology",
        "Robotic Surgery", "Science Communication",
        "Scientific Visualization", "Security Studies",
        "Seismology", "Semiconductor Physics",
        "Sensory Biology", "Sensory Psychology",
        "Signal Processing", "Smart Agriculture", "Smart Materials",
        "Social Epidemiology", "Social Innovation",
        "Social Law", "Social Neuroscience", "Social Psychology",
        "Social Work", "Sociolinguistics", "Soil Chemistry",
        "Soil Physics", "Soil Science", "Solar Engineering",
        "Space Architecture", "Space Biology", "Space Law",
        "Space Medicine", "Space Robotics", "Spatial Economics",
        "Spatial Linguistics", "Speech Processing",
        "Sport Psychology", "Sports Engineering", "Stable Isotopes",
        "Stellar Astronomy", "Structural Engineering",
        "Structural Geology", "Supply Chain Analytics",
        "Surface Chemistry", "Sustainable Agriculture",
        "Sustainable Architecture", "Sustainable Development",
        "Sustainable Design", "Sustainable Finance",
        "Synthetic Biology", "Systems Biology", "Systems Chemistry",
        "Systems Engineering", "Systems Neuroscience",
        "Taphonomy", "Taxonomy", "Technology Ethics",
        "Technology Forecasting", "Technology Policy",
        "Telecommunications Engineering", "Text Analytics",
        "Theoretical Biology", "Theoretical Chemistry",
        "Theoretical Computer Science", "Theoretical Linguistics",
        "Thermal Engineering", "Thermodynamics",
        "Topological Physics", "Toxicology", "Traffic Engineering",
        "Transhumanism", "Translational Medicine",
        "Transportation Engineering", "Tropical Ecology",
        "Urban Economics", "Urban Ecology", "Urban Planning",
        "Veterinary Medicine", "Video Game Design", "Virtual Production",
        "Virology", "Visual Communication", "Visual Neuroscience",
        "Voice Technology", "Volcanology", "Water Engineering",
        "Water Resources Management", "Wave Mechanics",
        "Wildlife Biology", "Wind Engineering", "Wood Science",
        "Zoology"
    ]

    #additional_topics = ["Artificial Intelligence", "Quantum Computing", "Renewable Energy"]  # Expand list
    new_entries = enrich_more_topics(additional_topics, depth=2)

    # Append to existing knowledge.json
    if os.path.exists("knowledge.json"):
        with open("knowledge.json", "r") as f:
            existing = json.load(f)
    else:
        existing = []

    # Avoid duplicates by source
    existing_sources = {d["source"] for d in existing}
    updated = existing + [d for d in new_entries if d["source"] not in existing_sources]

    with open("knowledge.json", "w") as f:
        json.dump(updated, f, indent=2)

    print(f"Added {len(new_entries)} new entries. Total now: {len(updated)}")


def backup_knowledge():
    """Create a backup of knowledge.json"""
    if os.path.exists("knowledge.json"):
        import shutil
        import datetime
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"knowledge_backup_{timestamp}.json"
        shutil.copy2("knowledge.json", backup_name)
        print(f"Created backup: {backup_name}")

if __name__ == "__main__":
    # Create backup first
    # backup_knowledge()
    
    # Run enrichment
    enricher = WikipediaEnricher()
    enricher.enrich_knowledge_comprehensive(max_total=1500)
    # enricher.enrich_more_topics()