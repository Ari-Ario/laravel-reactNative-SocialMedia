from fastapi import FastAPI
from pydantic import BaseModel
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
import json
import os
import time
from typing import List, Dict
import re

app = FastAPI()
KNOWLEDGE_PATH = "knowledge.json"

# ====================== LOAD KNOWLEDGE ======================
print("Loading knowledge base...")
if not os.path.exists(KNOWLEDGE_PATH):
    raise FileNotFoundError(f"Knowledge file not found: {KNOWLEDGE_PATH}")

with open(KNOWLEDGE_PATH, "r", encoding="utf-8") as f:
    docs = json.load(f)

print(f"✓ Loaded {len(docs)} knowledge entries")

# ====================== SETUP EMBEDDER AND FAISS ======================
print("Initializing RAG system...")
embedder = SentenceTransformer("all-MiniLM-L6-v2")

# Prepare texts for embedding
doc_texts = [doc["text"] for doc in docs]
doc_sources = [doc.get("source", "unknown") for doc in docs]

# Create embeddings and FAISS index
print("Creating embeddings...")
embeddings = embedder.encode(doc_texts, normalize_embeddings=True)
dim = embeddings.shape[1]
index = faiss.IndexFlatIP(dim)
index.add(embeddings.astype('float32'))

print(f"✓ FAISS index ready with {len(doc_texts)} entries")

class Query(BaseModel):
    question: str

def find_best_match(question: str) -> Dict:
    """Find the best matching knowledge entry"""
    
    # Clean the question
    question_clean = question.strip().lower()
    
    # Strategy 1: Direct keyword matching (fastest)
    question_words = set(question_clean.split())
    
    best_score = 0
    best_match = None
    
    for i, doc in enumerate(docs):
        doc_text = doc["text"].lower()
        doc_source = doc.get("source", "").lower()
        
        # Count word matches
        word_matches = len(question_words.intersection(set(doc_text.split())))
        
        # Also check source
        source_match = any(word in doc_source for word in question_words)
        
        score = word_matches + (5 if source_match else 0)
        
        if score > best_score:
            best_score = score
            best_match = {
                "text": doc["text"],
                "source": doc.get("source", "unknown"),
                "score": score,
                "index": i
            }
    
    # If keyword matching found something good (at least 2 word matches)
    if best_score >= 2:
        return best_match
    
    # Strategy 2: Semantic search (slower but more accurate)
    try:
        question_emb = embedder.encode([question_clean], normalize_embeddings=True)
        scores, indices = index.search(question_emb.astype('float32'), k=5)
        
        # Find the best semantic match with reasonable score
        best_semantic_score = 0
        best_semantic_match = None
        
        for i, (score, idx) in enumerate(zip(scores[0], indices[0])):
            if 0 <= idx < len(docs):
                # Only consider if score is decent
                if score > 0.3 and score > best_semantic_score:
                    best_semantic_score = score
                    best_semantic_match = {
                        "text": docs[idx]["text"],
                        "source": docs[idx].get("source", "unknown"),
                        "score": float(score),
                        "index": idx,
                        "method": "semantic"
                    }
        
        if best_semantic_match:
            return best_semantic_match
    
    except Exception as e:
        print(f"Semantic search error: {e}")
    
    # Return the best keyword match even if score is low
    return best_match

@app.post("/chat")
async def chat(query: Query):
    """Chat endpoint - returns best matching knowledge"""
    print(f"\nQuestion: '{query.question}'")
    start_time = time.time()
    
    result = find_best_match(query.question)
    
    if result and result.get("text"):
        elapsed = time.time() - start_time
        
        # Extract topic from source
        source = result["source"]
        if "wikipedia-" in source:
            topic = source.replace("wikipedia-", "").replace("-", " ").title()
        else:
            topic = source.replace("-", " ").title()
        
        print(f"✓ Found: {topic} (score: {result['score']}, time: {elapsed:.3f}s)")
        print(f"Answer preview: {result['text'][:100]}...")
        
        return {"answer": result["text"]}
    else:
        # No match found
        print(f"✗ No match found for: '{query.question}'")
        
        # Suggest some topics from knowledge base
        topics = set()
        for doc in docs[:20]:  # First 20 docs
            source = doc.get("source", "")
            if "wikipedia-" in source:
                topic = source.replace("wikipedia-", "").replace("-", " ").title()
                topics.add(topic)
        
        if topics:
            topics_list = list(topics)[:5]
            suggestion = f"I don't have specific information about '{query.question}'. I have information about: {', '.join(topics_list)}"
        else:
            suggestion = "I don't have information about that topic in my knowledge base."
        
        return {"answer": suggestion}

@app.post("/search")
async def search(query: Query):
    """Detailed search with scores"""
    result = find_best_match(query.question)
    
    if result and result.get("text"):
        return {
            "question": query.question,
            "found": True,
            "answer": result["text"],
            "source": result["source"],
            "score": result["score"],
            "method": result.get("method", "keyword")
        }
    else:
        return {
            "question": query.question,
            "found": False,
            "message": "No match found"
        }

@app.get("/health")
async def health():
    return {
        "status": "ready",
        "knowledge_entries": len(docs),
        "search_method": "keyword + semantic hybrid"
    }

# Test the system on startup
print("\n=== Testing Search ===")
test_questions = [
    "what is neural networks",
    "what is human brain",
    "what is renewable energy",
    "what is deep learning",
    "what is artificial intelligence"
]

for question in test_questions:
    result = find_best_match(question)
    if result:
        source = result["source"]
        if "wikipedia-" in source:
            topic = source.replace("wikipedia-", "").replace("-", " ").title()
        else:
            topic = source.replace("-", " ").title()
        print(f"✓ '{question}' -> {topic} (score: {result['score']})")
    else:
        print(f"✗ '{question}' -> No match")

print("\n=== RAG Search Engine Ready ===")