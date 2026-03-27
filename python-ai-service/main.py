
# ====================== CORE IMPORTS ======================
from fastapi import FastAPI, BackgroundTasks
# FastAPI for HTTP endpoints + background tasks

from pydantic import BaseModel
# Pydantic for request models

import faiss
# FAISS for vector similarity

import numpy as np
# Numerical arrays

from sentence_transformers import SentenceTransformer
# Text embeddings

import requests
from bs4 import BeautifulSoup
from datasets import load_dataset
# External ingestion deps:
# - requests + bs4 for Wikipedia/StackExchange
# - datasets for Hugging Face streaming

import json, os, time, re, hashlib, difflib
# Built-in utilities + hashing + fuzzy matching

from typing import List, Dict, Optional, Any
from collections import defaultdict


app = FastAPI()
# Creates the FastAPI application instance

KNOWLEDGE_PATH = "knowledge.json"
# Path to your knowledge database file



# ---------------------- PATCH: Requests session with headers for Wikipedia ----------------------
# ---------------------- PATCH: Requests session with headers for Wikipedia ----------------------
REQUEST_HEADERS = {
    # Use a descriptive UA with contact info per MediaWiki policy:
    # https://www.mediawiki.org/wiki/API:Etiquette#Identifying_your_client
    "User-Agent": "PythonAIService/1.0 (+https://example.com/contact; mostafanejad@yourdomain.com)",
    "Accept": "application/json",
}

# Reuse one session for all HTTP calls; helps with connection reuse and header consistency
HTTP = requests.Session()
HTTP.headers.update(REQUEST_HEADERS)




# ====================== LOAD AND INDEX KNOWLEDGE ======================
print("🚀 Loading knowledge base...")
if not os.path.exists(KNOWLEDGE_PATH):
    raise FileNotFoundError(f"Knowledge file not found: {KNOWLEDGE_PATH}")

with open(KNOWLEDGE_PATH, "r", encoding="utf-8") as f:
    docs = json.load(f)
# Reads the entire knowledge.json into memory
# Each entry: {"text": "...", "source": "..."}

print(f"✅ Loaded {len(docs)} knowledge entries")

# Create multiple indexes for better matching
keyword_index = defaultdict(list)  # word -> list of doc indices
source_index = {}                  # source -> doc
topic_index = {}                   # clean topic -> doc

# ---------------------- PATCH: Topic extraction from source ----------------------
def _extract_topic_from_source(src: str) -> str:
    """
    Derive a clean topic from `source`.
    Handles:
      - 'wikipedia-<topic>' synthetic keys
      - Wikipedia URLs like 'https://en.wikipedia.org/wiki/Sigmund_Freud' -> 'sigmund freud'
      - General sources by replacing dashes with spaces
    """
    s = (src or "").strip().lower()

    # Case 1: synthetic 'wikipedia-' keys
    if s.startswith("wikipedia-"):
        return s.replace("wikipedia-", "").replace("-", " ").strip()

    # Case 2: Wikipedia canonical URL
    if "wikipedia.org/wiki/" in s:
        try:
            title = s.split("wikipedia.org/wiki/")[1]
            title = title.split("#")[0].split("?")[0]     # strip anchors/queries
            title = title.replace("_", " ")
            title = re.sub(r"[^a-z0-9\s]", " ", title)    # keep alnum + spaces
            title = re.sub(r"\s+", " ", title).strip()
            return title
        except Exception:
            pass

    # Case 3: General fallback
    return s.replace("-", " ").strip()
# -------------------------------------------------------------------------------

for idx, doc in enumerate(docs):
    # Index by source
    source = doc.get("source", "").lower()
    source_index[source] = doc

    # PATCH: Use improved topic extraction for all sources
    clean_topic = _extract_topic_from_source(source)
    if clean_topic:
        topic_index[clean_topic] = doc

    # Index by keywords in text
    text = doc.get("text", "")
    words = set(re.findall(r'\b\w+\b', text.lower()))
    for word in words:
        if len(word) > 3:  # Only index meaningful words
            keyword_index[word].append(idx)


# ====================== SETUP EMBEDDER AND FAISS ======================
print("🤖 Initializing RAG system...")
# embedder = SentenceTransformer("all-MiniLM-L6-v2")
embedder = SentenceTransformer("multi-qa-mpnet-base-dot-v1")
# This converts text to numerical vectors

# Prepare embeddings for semantic search
doc_texts = [doc["text"] for doc in docs]
embeddings = embedder.encode(doc_texts, normalize_embeddings=True)
dim = embeddings.shape[1]
semantic_index = faiss.IndexFlatIP(dim)
semantic_index.add(embeddings.astype('float32'))
# Creates FAISS index for fast similarity search
# Uses: Cosine similarity (normalized dot product)

print(f"✅ Semantic index ready with {len(doc_texts)} entries")

class Query(BaseModel):
    question: str

# Common stop words to ignore / Improves accuracy by filtering out meaningless words
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
    # Example: "what is artificial intelligence" → ["artificial", "intelligence"]
    return keywords

# Tier 1: Exact Source Match (Highest Priority)
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

# Tier 2: Keyword Match (Medium Priority)
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

# Tier 3: Semantic Match (Fallback)
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



def live_wikipedia_fallback(question: str) -> Optional[Dict]:
    clean_q = clean_question(question)
    keywords = set(extract_keywords(question))

    API_SEARCH = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "list": "search",
        "srsearch": clean_q,
        "srlimit": 5,  # check more results
        "format": "json",
        "formatversion": 2,
    }

    try:
        r = HTTP.get(API_SEARCH, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        search_results = data.get("query", {}).get("search", [])

        if not search_results:
            return None

        # Try up to 3 top results for relevance
        for result in search_results[:3]:
            title = result["title"].lower()
            snippet = result.get("snippet", "").lower()

            # Simple relevance check: at least 2 keywords must appear in title or snippet
            title_words = set(re.findall(r'\w+', title))
            snippet_words = set(re.findall(r'\w+', snippet))
            matched = keywords.intersection(title_words | snippet_words)

            if len(matched) >= min(2, len(keywords)):  # at least 2 matches, or all if <2
                print(f"Relevant Wikipedia page found: {result['title']}")
                items = _wiki_fetch_pages([result["title"]])
                if items:
                    doc = items[0]
                    _append_items([doc])
                    return {
                        "text": doc["text"],
                        "source": doc["source"],
                        "score": 0.88,
                        "method": "live_wikipedia",
                        "confidence": "high"
                    }

        print("No relevant Wikipedia page found — skipping")
        return None

    except Exception as e:
        print(f"Live Wikipedia fallback failed: {e}")
        return None

# Tier 4: Live Stack Overflow Fallback for coding questions
def live_stackoverflow_fallback(question: str) -> Optional[Dict]:
    """Search Stack Overflow and return the best answer (not just the question)"""
    clean_q = clean_question(question)
    
    # Quick programming check
    programming_keywords = {"code", "python", "java", "javascript", "c++", "error", "bug", "how to", 
                           "function", "class", "api", "library", "framework", "debug", "fix"}
    keywords = set(extract_keywords(question))
    if not keywords.intersection(programming_keywords):
        return None

    search_url = "https://api.stackexchange.com/2.3/search/advanced"
    
    # Broader search in title + body
    params = {
        "order": "desc",
        "sort": "relevance",
        "q": clean_q,           # searches title AND body
        "site": "stackoverflow",
        "pagesize": 5,
        "filter": "withbody"    # includes question body
    }

    try:
        r = requests.get(search_url, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        items = data.get("items", [])
        
        if not items:
            return None

        # Relevance filtering
        required_matches = max(3, int(len(keywords) * 0.6))
        for item in items:
            title = item["title"].lower()
            body_text = BeautifulSoup(item.get("body", ""), "html.parser").get_text().lower()
            combined = title + " " + body_text
            matched = len(keywords.intersection(set(re.findall(r'\w+', combined))))
            
            if matched >= required_matches or item.get("is_answered", False):
                question_id = item["question_id"]
                link = item["link"]
                break
        else:
            print("No relevant SO question found")
            return None

        # Step 2: Fetch answers for this question
        answers_url = f"https://api.stackexchange.com/2.3/questions/{question_id}/answers"
        answers_params = {
            "order": "desc",
            "sort": "votes",
            "site": "stackoverflow",
            "filter": "withbody"  # includes answer.body
        }
        ra = requests.get(answers_url, params=answers_params, timeout=30)
        ra.raise_for_status()
        answers_data = ra.json()
        answers = answers_data.get("items", [])
        
        if not answers:
            return None

        # Prefer accepted answer, else highest voted
        accepted = [a for a in answers if a.get("is_accepted")]
        best_answer = accepted[0] if accepted else max(answers, key=lambda a: a.get("score", 0))

        # Build rich response
        text_parts = []
        text_parts.append(f"Question: {item['title']}\n")
        text_parts.append(f"Link: {link}\n\n")

        answer_body = best_answer.get("body", "No answer body available")
        clean_answer = BeautifulSoup(answer_body, "html.parser").get_text()
        
        score_text = f" (Score: {best_answer.get('score', 0)}"
        score_text += ", Accepted" if best_answer.get("is_accepted") else ""
        score_text += ")"
        
        text_parts.append(f"Best Answer{score_text}:\n{clean_answer}")

        full_text = "\n".join(text_parts)[:10000]  # limit size

        doc = {"text": full_text, "source": link}
        _append_items([doc])

        return {
            "text": full_text,
            "source": link,
            "score": 0.90,
            "method": "live_stackoverflow",
            "confidence": "high"
        }

    except Exception as e:
        print(f"Stack Overflow fallback failed: {e}")
        return None

# Tier 6: Live Reddit Search
def live_reddit_fallback(question: str) -> Optional[Dict]:
    """Search Reddit for discussions/opinions"""
    clean_q = clean_question(question)
    
    try:
        search_url = "https://www.reddit.com/search.json"
        params = {
            "q": clean_q,
            "sort": "relevance",
            "t": "all",
            "limit": 5,
            "raw_json": 1
        }
        headers = {"User-Agent": "PythonAIService/1.0 (local RAG bot)"}
        r = requests.get(search_url, params=params, headers=headers, timeout=30)
        r.raise_for_status()
        data = r.json()
        posts = data.get("data", {}).get("children", [])
        
        if not posts:
            return None
        
        # Combine top 2-3 relevant posts
        text_parts = ["Relevant Reddit discussions:\n"]
        for post in posts[:3]:
            p = post["data"]
            title = p.get("title", "")
            selftext = p.get("selftext", "")[:2000]
            url = f"https://reddit.com{p.get('permalink', '')}"
            text_parts.append(f"• {title}\n{selftext}\n(Source: {url})\n")
        
        full_text = "\n".join(text_parts)
        
        doc = {"text": full_text, "source": f"reddit_search:{clean_q}"}
        _append_items([doc])
        
        return {
            "text": full_text,
            "source": "reddit_search",
            "score": 0.82,
            "method": "live_reddit",
            "confidence": "medium"
        }
    except Exception as e:
        print(f"Reddit fallback failed: {e}")
        return None

# Tier 7: GitHub Code Search (public repos)
def live_github_code_fallback(question: str) -> Optional[Dict]:
    """Search public GitHub repos for code/examples"""
    keywords = extract_keywords(question)
    if not any(k in keywords for k in ["code", "python", "java", "javascript", "example", "snippet", "implement"]):
        return None  # only trigger for likely code questions
    
    clean_q = clean_question(question)
    try:
        search_url = "https://api.github.com/search/code"
        params = {"q": clean_q}
        headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "PythonAIService"}
        r = requests.get(search_url, params=params, headers=headers, timeout=30)
        if r.status_code == 403:  # rate limit
            time.sleep(10)
            r = requests.get(search_url, params=params, headers=headers, timeout=30)
        r.raise_for_status()
        data = r.json()
        items = data.get("items", [])[:3]
        
        if not items:
            return None
        
        text_parts = ["Relevant code from GitHub public repos:\n"]
        for item in items:
            repo = item["repository"]["full_name"]
            path = item["path"]
            url = item["html_url"]
            text_parts.append(f"• {repo}/{path}\nLink: {url}\n")
        
        full_text = "\n".join(text_parts)
        doc = {"text": full_text, "source": f"github_code:{clean_q}"}
        _append_items([doc])
        
        return {
            "text": full_text,
            "source": "github_code_search",
            "score": 0.80,
            "method": "live_github_code",
            "confidence": "medium"
        }
    except Exception as e:
        print(f"GitHub code fallback failed: {e}")
        return None

# Tier 8: ArXiv Research Papers
def live_arxiv_fallback(question: str) -> Optional[Dict]:
    """Search arXiv for academic/research papers"""
    clean_q = clean_question(question)
    
    try:
        search_url = "http://export.arxiv.org/api/query"
        params = {
            "search_query": f"all:{clean_q}",
            "start": 0,
            "max_results": 3,
            "sortBy": "relevance",
            "sortOrder": "descending"
        }
        r = requests.get(search_url, params=params, timeout=30)
        r.raise_for_status()
        
        import feedparser
        feed = feedparser.parse(r.text)
        entries = feed.entries
        
        if not entries:
            return None
        
        text_parts = ["Relevant research papers from arXiv:\n"]
        for entry in entries:
            title = entry.title
            summary = entry.summary[:1500]
            link = entry.link
            text_parts.append(f"• {title}\n{summary}\n(PDF: {link})\n")
        
        full_text = "\n".join(text_parts)
        doc = {"text": full_text, "source": f"arxiv:{clean_q}"}
        _append_items([doc])
        
        return {
            "text": full_text,
            "source": "arxiv_search",
            "score": 0.84,
            "method": "live_arxiv",
            "confidence": "high"
        }
    except Exception as e:
        print(f"arXiv fallback failed: {e}")
        return None

# Tier 9: YouTube Transcripts
def live_youtube_fallback(question: str) -> Optional[Dict]:
    """Search YouTube and get transcript from top relevant video"""
    clean_q = clean_question(question)
    
    try:
        # First: simple YouTube search to find top video
        search_url = "https://www.youtube.com/results"
        params = {"search_query": clean_q}
        headers = {"User-Agent": "PythonAIService/1.0"}
        r = requests.get(search_url, params=params, headers=headers, timeout=30)
        r.raise_for_status()
        
        # Extract first video ID (simple regex - works reliably)
        match = re.search(r"watch\?v=([a-zA-Z0-9_-]{11})", r.text)
        if not match:
            return None
        video_id = match.group(1)
        video_url = f"https://www.youtube.com/watch?v={video_id}"
        
        # Get transcript
        from youtube_transcript_api import YouTubeTranscriptApi
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        transcript = transcript_list.find_generated_transcript(['en']) or transcript_list.find_transcript(['en'])
        transcript_data = transcript.fetch()
        
        full_text = " ".join([t['text'] for t in transcript_data])
        full_text = f"YouTube video transcript:\n\n{full_text[:10000]}...\n\nSource: {video_url}"
        
        doc = {"text": full_text, "source": video_url}
        _append_items([doc])
        
        return {
            "text": full_text,
            "source": video_url,
            "score": 0.78,
            "method": "live_youtube",
            "confidence": "medium"
        }
    except Exception as e:
        print(f"YouTube fallback failed: {e}")
        return None

# ---------------------- PATCH: GitHub Token for higher rate limits ----------------------
GITHUB_TOKEN = "your_token_here"  # put at top of file

# Then in live_github_code_fallback:
headers = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": f"token {GITHUB_TOKEN}",
    "User-Agent": "PythonAIService"
}

# 🤝 Orchestrator Function
def find_best_answer(question: str) -> Dict:
    """Find best answer using multiple strategies with strict thresholds + live fallback"""
    start_time = time.time()

    # === Tier 1: Exact source/topic match ===
    exact_result = exact_source_match(question)
    if exact_result:
        exact_result["search_time"] = time.time() - start_time
        return exact_result  # highest priority

    # === Tier 2: Keyword match ===
    keyword_result = keyword_match(question)
    if keyword_result and keyword_result.get("score", 0) >= 0.6:
        keyword_result["search_time"] = time.time() - start_time
        return keyword_result

    # === Tier 3: Semantic match ===
    semantic_result = semantic_match(question)
    if semantic_result and semantic_result.get("score", 0) >= 0.6:
        semantic_result["search_time"] = time.time() - start_time
        return semantic_result

    # Tier 4: Stack Overflow FIRST for coding questions
    print("Trying Stack Overflow...")
    so = live_stackoverflow_fallback(question)
    if so:
        so["search_time"] = time.time() - start_time
        return so

    # Tier 5: GitHub code search
    print("Trying GitHub code...")
    github = live_github_code_fallback(question)
    if github:
        github["search_time"] = time.time() - start_time
        return github

    # Tier 6: Wikipedia (now safer with relevance check)
    print("Trying Wikipedia...")
    wiki = live_wikipedia_fallback(question)
    if wiki:
        wiki["search_time"] = time.time() - start_time
        return wiki

    # Tier 7: arXiv (research)
    print("Trying arXiv...")
    arxiv = live_arxiv_fallback(question)
    if arxiv:
        arxiv["search_time"] = time.time() - start_time
        return arxiv

    # Tier 8: Reddit
    print("Trying Reddit...")
    reddit = live_reddit_fallback(question)
    if reddit:
        reddit["search_time"] = time.time() - start_time
        return reddit

    # Tier 9: YouTube
    print("Trying YouTube...")
    yt = live_youtube_fallback(question)
    if yt:
        yt["search_time"] = time.time() - start_time
        return yt

    return {
        "text": None,
        "score": 0,
        "search_time": time.time() - start_time,
        "method": "none",
        "confidence": "low"
    }

# ====================== INGESTION + HOT RELOAD ADDITIONS ======================
# ---- Dedup index based on current knowledge.json ----
text_hashes = set()
for d in docs:
    try:
        h = hashlib.sha256(d.get("text", "").strip().encode("utf-8")).hexdigest()
        text_hashes.add(h)
    except Exception:
        continue

def _text_hash(t: str) -> str:
    return hashlib.sha256((t or "").strip().encode("utf-8")).hexdigest()

# ---- Atomic write helper ----
def _atomic_write_json(path: str, data: List[Dict[str, Any]]):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)

# ---- Index updaters (reuse your logic) ----
def _update_in_memory_indexes(new_items: List[Dict[str, str]]):
    """Update source_index, topic_index, keyword_index and FAISS incrementally."""
    global docs, source_index, topic_index, keyword_index, semantic_index

    # 1) Append to in-memory docs
    start_len = len(docs)
    docs.extend(new_items)

    # 2) Update keyword/source/topic indexes
    for idx, doc in enumerate(new_items, start=start_len):
        src = doc.get("source", "").lower()
        source_index[src] = doc

        # PATCH: use improved topic extraction for new items
        clean_topic = _extract_topic_from_source(src)
        if clean_topic:
            topic_index[clean_topic] = doc

        # Keyword index
        text = doc.get("text", "").lower()
        words = set(re.findall(r'\b\w+\b', text))
        for w in words:
            if len(w) > 3:
                keyword_index[w].append(idx)

    # 3) Incremental FAISS add
    try:
        new_texts = [it["text"] for it in new_items if it.get("text")]
        if new_texts:
            new_embs = embedder.encode(new_texts, normalize_embeddings=True)
            semantic_index.add(new_embs.astype("float32"))
    except Exception as e:
        print(f"⚠️ FAISS incremental add failed: {e}")

def _append_items(items: List[Dict[str, str]], flush_every: int = 5000) -> int:
    """Append deduped items to disk (knowledge.json) and update memory+FAISS."""
    if not items:
        return 0

    unique = []
    added = 0
    for it in items:
        t = it.get("text", "")
        s = it.get("source", "")
        if not t or not s:
            continue
        h = _text_hash(t)
        if h in text_hashes:
            continue
        text_hashes.add(h)
        unique.append({"text": t, "source": s})

        # Flush in chunks to avoid huge memory
        if len(unique) >= flush_every:
            try:
                with open(KNOWLEDGE_PATH, "r", encoding="utf-8") as f:
                    current = json.load(f)
            except Exception:
                current = []
            current.extend(unique)
            _atomic_write_json(KNOWLEDGE_PATH, current)
            _update_in_memory_indexes(unique)
            added += len(unique)
            unique = []

    # Final flush
    if unique:
        try:
            with open(KNOWLEDGE_PATH, "r", encoding="utf-8") as f:
                current = json.load(f)
        except Exception:
            current = []
        current.extend(unique)
        _atomic_write_json(KNOWLEDGE_PATH, current)
        _update_in_memory_indexes(unique)
        added += len(unique)

    print(f"📥 Appended {added} new items to knowledge.json")
    return added

# ====================== INGEST FROM WIKIPEDIA (BATCH + SEARCH) ======================
class WikiTitles(BaseModel):
    titles: List[str]
    batch_size: int = 20
    sleep: float = 0.3
    formatversion: int = 2  # IMPROVEMENT: cleaner JSON structure from MediaWiki

def _wiki_fetch_pages(titles_batch: List[str]) -> List[Dict[str, str]]:
    """Fetch extracts+canonical URLs for a batch of titles. Returns [{text, source}] items."""
    API = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "prop": "extracts|info",
        "explaintext": 1,           # plain text
        "inprop": "url",            # include full canonical URL
        "format": "json",
        "formatversion": 2,         # IMPROVEMENT: a bit cleaner
        "titles": "|".join(titles_batch),
    }
    try:
        r = HTTP.get(API, params=params, timeout=60)
        # PATCH: Friendly handling of Wikipedia anti-abuse 403
        if r.status_code == 403:
            print("⚠️ Wikipedia returned 403. Check your User-Agent header and request volume. Retrying with small batch...")
            # One retry: smaller batch size or a slight delay
            time.sleep(1.0)
            r = HTTP.get(API, params=params, timeout=60)
        r.raise_for_status()
    except requests.HTTPError as e:
        print(f"❌ Wikipedia HTTP error: {e} - params={params}")
        return []
    except Exception as e:
        print(f"❌ Wikipedia request error: {e}")
        return []

    data = r.json()
    pages = data.get("query", {}).get("pages", [])
    items = []
    for p in pages:
        text = p.get("extract", "") or ""
        source = p.get("fullurl", "") or ""
        # Only append meaningful items
        if text.strip() and source.strip():
            items.append({"text": text, "source": source})
    return items


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
# print("\n🔥 Warming up system with test cases...")
# test_cases = [
#     ("what is artificial intelligence", 0.8, "Should match"),
#     ("explain quantum computing", 0.7, "Should match"),
#     ("tell me about renewable energy", 0.8, "Should match"),
#     ("what is blablabla nonsense", 0.0, "Should NOT match"),
#     ("how to cook pasta", 0.0, "Should NOT match"),
#     ("random question about nothing", 0.0, "Should NOT match"),
# ]

# print("Test Results:")
# print("-" * 80)
# for question, expected_min_score, note in test_cases:
#     result = find_best_answer(question)
#     score = result.get("score", 0)
#     status = "✅ PASS" if score >= expected_min_score else "❌ FAIL"
#     method = result.get("method", "none")
#     print(f"{status} '{question[:40]}...' -> score: {score:.3f} (method: {method}) - {note}")

print("\n🎯 ===== ACCURATE RAG SEARCH READY ===== 🎯")
print(f"📡 Endpoint: http://127.0.0.1:8001")
print(f"📊 Knowledge: {len(docs)} entries")
print(f"⚡ Confidence threshold: 0.6")
print(f"🎯 Accuracy: High (exact + keyword + semantic matching)")
print("=" * 50)