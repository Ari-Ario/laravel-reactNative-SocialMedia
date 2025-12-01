import wikipediaapi
import json
import os

class WikipediaEnricher:
    def __init__(self):
        self.wiki = wikipediaapi.Wikipedia(
            user_agent='MyChatbot/1.0',
            language='en',
            extract_format=wikipediaapi.ExtractFormat.WIKI
        )
    
    def get_topics(self):
        """Common topics to enrich knowledge base"""
        return [
            "Artificial intelligence", "Machine learning", "Deep learning",
            "Quantum computing", "Computer science", "Physics",
            "Biology", "Chemistry", "Mathematics", 
            "Neuroscience", "Psychology", "Economics",
            "Climate change", "Renewable energy", "Space exploration",
            "Genetic engineering", "Robotics", "Internet",
            "Blockchain", "Virtual reality", "Augmented reality",
            "Natural language processing", "Computer vision", "Data science",
            "Big data", "Cloud computing", "Cybersecurity",
            "Bioinformatics", "Nanotechnology", "Renewable energy"
        ]
    
    def enrich_knowledge(self, max_articles=50):
        """Enrich knowledge.json with Wikipedia content"""
        
        # Load existing knowledge
        if os.path.exists("knowledge.json"):
            with open("knowledge.json", "r", encoding="utf-8") as f:
                knowledge_base = json.load(f)
        else:
            knowledge_base = []
        
        existing_sources = {item['source'] for item in knowledge_base}
        
        topics = self.get_topics()
        added_count = 0
        
        for topic in topics:
            if added_count >= max_articles:
                break
                
            source_id = f"wikipedia-{topic.replace(' ', '-').lower()}"
            if source_id in existing_sources:
                continue
                
            print(f"Fetching: {topic}")
            page = self.wiki.page(topic)
            
            if page.exists() and page.summary:
                # Clean and truncate summary
                summary = page.summary
                # Remove citation markers [1], [2], etc.
                summary = ' '.join(summary.split('\n')[:3])  # First 3 paragraphs
                summary = summary[:400] + "..." if len(summary) > 400 else summary
                
                knowledge_base.append({
                    "text": summary,
                    "source": source_id
                })
                added_count += 1
                print(f"✓ Added: {topic}")
            else:
                print(f"✗ Not found: {topic}")
        
        # Save enriched knowledge base
        with open("knowledge.json", "w", encoding="utf-8") as f:
            json.dump(knowledge_base, f, indent=2, ensure_ascii=False)
        
        print(f"Enriched knowledge base with {added_count} new articles")
        print(f"Total entries: {len(knowledge_base)}")
        
        return knowledge_base

if __name__ == "__main__":
    enricher = WikipediaEnricher()
    enricher.enrich_knowledge(max_articles=30)