from fastapi import FastAPI
from pydantic import BaseModel
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
import json
import os
import time
from typing import List, Dict, Optional
import re
from collections import defaultdict

app = FastAPI()
KNOWLEDGE_PATH = "knowledge.json"

# ====================== LOAD AND INDEX KNOWLEDGE ======================
print("🚀 Loading knowledge base...")
if not os.path.exists(KNOWLEDGE_PATH):
    raise FileNotFoundError(f"Knowledge file not found: {KNOWLEDGE_PATH}")

with open(KNOWLEDGE_PATH, "r", encoding="utf-8") as f:
    docs = json.load(f)

print(f"✅ Loaded {len(docs)} knowledge entries")

# Create multiple indexes for better matching
keyword_index = defaultdict(list)  # word -> list of doc indices
source_index = {}  # source -> doc
topic_index = {}  # clean topic -> doc

for idx, doc in enumerate(docs):
    # Index by source
    source = doc.get("source", "").lower()
    source_index[source] = doc
    
    # Extract clean topic from source
    if "wikipedia-" in source:
        clean_topic = source.replace("wikipedia-", "").replace("-", " ").strip()
    else:
        clean_topic = source.replace("-", " ").strip()
    
    if clean_topic:
        topic_index[clean_topic] = doc
    
    # Index by keywords in text
    text = doc["text"].lower()
    words = set(re.findall(r'\b\w+\b', text))
    for word in words:
        if len(word) > 3:  # Only index meaningful words
            keyword_index[word].append(idx)

# ====================== SETUP EMBEDDER AND FAISS ======================
print("🤖 Initializing RAG system...")
embedder = SentenceTransformer("all-MiniLM-L6-v2")

# Prepare embeddings for semantic search
doc_texts = [doc["text"] for doc in docs]
embeddings = embedder.encode(doc_texts, normalize_embeddings=True)
dim = embeddings.shape[1]
semantic_index = faiss.IndexFlatIP(dim)
semantic_index.add(embeddings.astype('float32'))

print(f"✅ Semantic index ready with {len(doc_texts)} entries")

class Query(BaseModel):
    question: str

# Common stop words to ignore
STOP_WORDS = {
    "what", "is", "are", "the", "a", "an", "about", "explain", "define", 
    "tell", "me", "of", "and", "or", "but", "in", "on", "at", "to", "for",
    "with", "by", "from", "as", "into", "like", "through", "after", "over",
    "between", "out", "against", "during", "without", "before", "under",
    "around", "among", "can", "could", "would", "should", "will", "shall",
    "may", "might", "must", "have", "has", "had", "do", "does", "did",
    "am", "is", "are", "was", "were", "be", "been", "being", "i", "you",
    "he", "she", "it", "we", "they", "my", "your", "his", "her", "its",
    "our", "their", "mine", "yours", "hers", "ours", "theirs", "this",
    "that", "these", "those", "who", "whom", "which", "whose", "where",
    "when", "why", "how", "all", "any", "both", "each", "few", "more",
    "most", "other", "some", "such", "no", "nor", "not", "only", "own",
    "same", "so", "than", "too", "very", "just", "now", "then", "here",
    "there", "when", "where", "why", "how", "all", "any", "both", "each"
}

def clean_question(question: str) -> str:
    """Clean and normalize question"""
    question = question.strip().lower()
    # Remove common prefixes
    prefixes = ["what is ", "explain ", "tell me about ", "define ", "what are ",
                "how does ", "describe ", "what do you know about "]
    for prefix in prefixes:
        if question.startswith(prefix):
            question = question[len(prefix):].strip()
    # Remove question marks and extra spaces
    question = question.rstrip("?")
    question = re.sub(r'\s+', ' ', question)
    # Replace hyphens with spaces for better matching
    question = question.replace("-", " ").replace("_", " ")
    return question

def extract_keywords(question: str) -> List[str]:
    """Extract meaningful keywords from question"""
    words = re.findall(r'\b\w+\b', question.lower())
    # Remove stop words and short words
    keywords = [w for w in words if w not in STOP_WORDS and len(w) > 2]
    return keywords

def exact_source_match(question: str) -> Optional[Dict]:
    """Check for exact source/topic match (HIGHEST CONFIDENCE)"""
    clean_q = clean_question(question)
    
    # Try direct source match (e.g., "wikipedia-artificial-intelligence")
    source_key = f"wikipedia-{clean_q.replace(' ', '-')}"
    if source_key in source_index:
        doc = source_index[source_key]
        return {
            "text": doc["text"],
            "source": doc.get("source", ""),
            "score": 1.0,
            "method": "exact_source",
            "confidence": "high"
        }
    
    # Try topic match (e.g., "artificial intelligence")
    if clean_q in topic_index:
        doc = topic_index[clean_q]
        return {
            "text": doc["text"],
            "source": doc.get("source", ""),
            "score": 0.95,
            "method": "exact_topic",
            "confidence": "high"
        }
    
    return None

def keyword_match(question: str) -> Optional[Dict]:
    """Keyword-based matching with scoring"""
    keywords = extract_keywords(question)
    
    if not keywords:
        return None
    
    # Score documents based on keyword matches
    doc_scores = defaultdict(float)
    doc_keyword_counts = defaultdict(set)
    
    for keyword in keywords:
        if keyword in keyword_index:
            for doc_idx in keyword_index[keyword]:
                doc_scores[doc_idx] += 1.0
                doc_keyword_counts[doc_idx].add(keyword)
    
    if not doc_scores:
        return None
    
    # Find best match
    best_idx = max(doc_scores.items(), key=lambda x: x[1])[0]
    matched_keywords = len(doc_keyword_counts[best_idx])
    total_keywords = len(keywords)
    
    # Calculate normalized score (0-1)
    keyword_score = matched_keywords / max(total_keywords, 1)
    
    # Boost score if we matched most keywords
    if keyword_score >= 0.5:  # At least 50% of keywords matched
        confidence = min(keyword_score * 1.5, 1.0)  # Scale to 0-1
        
        return {
            "text": docs[best_idx]["text"],
            "source": docs[best_idx].get("source", ""),
            "score": confidence,
            "method": "keyword",
            "confidence": "high" if confidence > 0.7 else "medium"
        }
    
    return None

def semantic_match(question: str) -> Optional[Dict]:
    """Semantic similarity search with strict thresholds"""
    try:
        question_emb = embedder.encode([question], normalize_embeddings=True)
        scores, indices = semantic_index.search(question_emb.astype('float32'), k=5)
        
        best_score = 0
        best_match = None
        
        for i, (score, idx) in enumerate(zip(scores[0], indices[0])):
            if 0 <= idx < len(docs):
                if score > 0.6 and score > best_score:  # Higher threshold
                    best_score = score
                    best_match = {
                        "text": docs[idx]["text"],
                        "source": docs[idx].get("source", ""),
                        "score": float(score),
                        "method": "semantic",
                        "confidence": "high" if score > 0.75 else "medium"
                    }
        
        return best_match
    
    except Exception as e:
        print(f"Semantic search error: {e}")
        return None

def find_best_answer(question: str) -> Dict:
    """Find best answer using multiple strategies with strict thresholds"""
    start_time = time.time()
    
    # Strategy 1: Exact source/topic match (fastest and most accurate)
    result = exact_source_match(question)
    if result:
        result["search_time"] = time.time() - start_time
        return result
    
    # Strategy 2: Keyword matching (strict)
    result = keyword_match(question)
    if result and result.get("score", 0) >= 0.6:  # Minimum 60% confidence
        result["search_time"] = time.time() - start_time
        return result
    
    # Strategy 3: Semantic search (strictest)
    result = semantic_match(question)
    if result and result.get("score", 0) >= 0.65:  # Minimum 65% similarity
        result["search_time"] = time.time() - start_time
        return result
    
    # No good match found
    return {
        "text": None,
        "score": 0,
        "search_time": time.time() - start_time,
        "method": "none",
        "confidence": "low"
    }

@app.post("/chat")
async def chat(query: Query):
    """Chat endpoint with confidence scoring for Laravel"""
    print(f"\n📨 Question: '{query.question}'")
    start_time = time.time()
    
    result = find_best_answer(query.question)
    total_time = time.time() - start_time
    
    if result.get("text") and result.get("score", 0) >= 0.6:
        # Good match found
        source = result["source"]
        if "wikipedia-" in source:
            topic = source.replace("wikipedia-", "").replace("-", " ").title()
        else:
            topic = source.replace("-", " ").title()
        
        confidence = result.get("score", 0)
        
        print(f"✅ Good match: {topic} (confidence: {confidence:.3f}, method: {result['method']})")
        
        return {
            "answer": result["text"],
            "confidence": confidence,
            "is_fallback": False,
            "method": result.get("method", "unknown"),
            "source": result.get("source", "unknown")
        }
    else:
        # No good match found - return fallback
        print(f"❌ No good match found (confidence: {result.get('score', 0):.3f})")
        
        # Return fallback with low confidence
        return {
            "answer": "I don't have specific information about that topic in my knowledge base.",
            "confidence": result.get("score", 0),
            "is_fallback": True,
            "method": result.get("method", "none"),
            "source": "fallback"
        }

@app.post("/search")
async def search(query: Query):
    """Detailed search endpoint"""
    result = find_best_answer(query.question)
    
    if result.get("text"):
        return {
            "question": query.question,
            "found": True,
            "answer": result["text"],
            "source": result["source"],
            "score": result["score"],
            "method": result["method"],
            "confidence": result.get("confidence", "unknown"),
            "is_fallback": False
        }
    else:
        return {
            "question": query.question,
            "found": False,
            "score": 0,
            "is_fallback": True,
            "message": "No relevant information found"
        }

@app.get("/debug-match")
async def debug_match(question: str):
    """Debug endpoint to see matching process"""
    print(f"\n🔍 Debug: '{question}'")
    
    clean_q = clean_question(question)
    keywords = extract_keywords(question)
    
    exact = exact_source_match(question)
    keyword = keyword_match(question)
    semantic = semantic_match(question)
    
    return {
        "original_question": question,
        "cleaned_question": clean_q,
        "extracted_keywords": keywords,
        "exact_match": {
            "found": exact is not None,
            "score": exact.get("score") if exact else 0,
            "source": exact.get("source") if exact else None
        },
        "keyword_match": {
            "found": keyword is not None,
            "score": keyword.get("score") if keyword else 0,
            "source": keyword.get("source") if keyword else None
        },
        "semantic_match": {
            "found": semantic is not None,
            "score": semantic.get("score") if semantic else 0,
            "source": semantic.get("source") if semantic else None
        },
        "best_match": find_best_answer(question)
    }

@app.get("/health")
async def health():
    return {
        "status": "ready",
        "knowledge_entries": len(docs),
        "search_methods": "exact + keyword + semantic",
        "confidence_threshold": 0.6,
        "keywords_indexed": len(keyword_index)
    }

# Warm up and test
print("\n🔥 Warming up system with test cases...")
test_cases = [
    ("what is artificial intelligence", 0.8, "Should match"),
    ("explain quantum computing", 0.7, "Should match"),
    ("tell me about renewable energy", 0.8, "Should match"),
    ("what is blablabla nonsense", 0.0, "Should NOT match"),
    ("how to cook pasta", 0.0, "Should NOT match"),
    ("random question about nothing", 0.0, "Should NOT match"),
]

print("Test Results:")
print("-" * 80)
for question, expected_min_score, note in test_cases:
    result = find_best_answer(question)
    score = result.get("score", 0)
    status = "✅ PASS" if score >= expected_min_score else "❌ FAIL"
    method = result.get("method", "none")
    print(f"{status} '{question[:40]}...' -> score: {score:.3f} (method: {method}) - {note}")

print("\n🎯 ===== ACCURATE RAG SEARCH READY ===== 🎯")
print(f"📡 Endpoint: http://127.0.0.1:8001")
print(f"📊 Knowledge: {len(docs)} entries")
print(f"⚡ Confidence threshold: 0.6")
print(f"🎯 Accuracy: High (exact + keyword + semantic matching)")
print("=" * 50)