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
            "Category:Science", "Category:Technology", "Category:Mathematics",
            "Category:Computer_science", "Category:Physics", "Category:Chemistry",
            "Category:Biology", "Category:Medicine", "Category:Engineering",
            "Category:Artificial_intelligence", "Category:Machine_learning",
            "Category:Data_science", "Category:Cybersecurity", 
            "Category:Renewable_energy", "Category:Climate_change",
            "Category:Space_exploration", "Category:Robotics",
            "Category:Internet", "Category:Blockchain", "Category:Cryptocurrency"
        ]
    
    def clean_text(self, text: str, max_length: int = 500) -> str:
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
    
    def enrich_from_list(self, topics: List[str], max_articles: int = 100) -> int:
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
    
    def enrich_knowledge_comprehensive(self, max_total: int = 200):
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
    additional_topics = ["Artificial Intelligence", "Quantum Computing", "Renewable Energy"]  # Expand list
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
    backup_knowledge()
    
    # Run enrichment
    enricher = WikipediaEnricher()
    enricher.enrich_knowledge_comprehensive(max_total=150)
    # enricher.enrich_more_topics()