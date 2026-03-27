from fastapi import FastAPI
from pydantic import BaseModel
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from transformers import pipeline, AutoTokenizer, AutoModelForCausalLM
import torch
import json
import os
import re

app = FastAPI()

MODEL_NAME = "microsoft/DialoGPT-medium"
KNOWLEDGE_PATH = "knowledge.json"

# ====================== LOAD KNOWLEDGE ======================
print("Loading knowledge base...")
with open(KNOWLEDGE_PATH, "r", encoding="utf-8") as f:
    docs = json.load(f)
print(f"✓ Loaded {len(docs)} knowledge entries")

# Show sample of what's available
print("\nSample knowledge entries:")
for i, doc in enumerate(docs[:5]):
    print(f"  {i+1}. {doc['source']}: {doc['text'][:80]}...")

# ====================== EMBEDDER ======================
print("Loading MiniLM...")
embedder = SentenceTransformer("all-MiniLM-L6-v2")

# ====================== MODEL ======================
print("Loading DialoGPT-medium...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)

if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

generator = pipeline(
    "text-generation",
    model=model,
    tokenizer=tokenizer,
    max_new_tokens=120,
    temperature=0.8,
    do_sample=True,
    top_p=0.9,
)

# ====================== FAISS INDEX ======================
print("Creating FAISS index...")
doc_texts = [d["text"] for d in docs]
embeddings = embedder.encode(doc_texts, normalize_embeddings=True)
dim = embeddings.shape[1]
index = faiss.IndexFlatIP(dim)
index.add(embeddings.astype('float32'))
print(f"✓ FAISS index ready with {len(doc_texts)} entries")

class Query(BaseModel):
    question: str

@app.post("/chat")
async def chat(query: Query):
    print(f"\n=== NEW QUESTION: '{query.question}' ===")
    
    # === DEBUG RAG SEARCH ===
    print("Searching for relevant context...")
    question_emb = embedder.encode([query.question], normalize_embeddings=True)
    D, I = index.search(question_emb.astype('float32'), k=5)
    
    print("Top 5 matches found:")
    for i, (score, idx) in enumerate(zip(D[0], I[0])):
        if 0 <= idx < len(docs):
            source = docs[idx]["source"]
            text_preview = docs[idx]["text"][:80] + "..." if len(docs[idx]["text"]) > 80 else docs[idx]["text"]
            print(f"  {i+1}. Score: {score:.3f} | Source: {source}")
            print(f"     Text: {text_preview}")
    
    # Take top 2 contexts
    contexts = []
    for idx in I[0][:2]:
        if 0 <= idx < len(docs):
            contexts.append(docs[idx]["text"])
    
    if contexts:
        context_str = "\n".join([f"- {ctx}" for ctx in contexts])
        prompt = f"""Based on this information:

{context_str}

Question: {query.question}

Please provide a helpful answer using the information above.

Answer:"""
        print(f"Using {len(contexts)} context(s) for generation")
    else:
        prompt = f"Question: {query.question}\n\nAnswer:"
        print("No context found, using direct generation")
    
    # === GENERATION ===
    try:
        result = generator(
            prompt,
            max_new_tokens=120,
            do_sample=True,
            temperature=0.8,
            top_p=0.9,
            return_full_text=False,
        )

        answer = result[0]["generated_text"].strip()
        
        # Simple cleaning
        for pattern in ["Question:", "Based on this information:", "Answer:"]:
            if pattern in answer:
                answer = answer.split(pattern)[-1].strip()
        
        print(f"✓ Final answer: {answer}")
        return {"answer": answer}

    except Exception as e:
        print(f"✗ Error: {e}")
        return {"answer": "I'd be happy to help with that. Could you provide more details?"}

@app.get("/knowledge-stats")
async def knowledge_stats():
    sources = {}
    for doc in docs:
        source = doc["source"]
        sources[source] = sources.get(source, 0) + 1
    
    return {
        "total_entries": len(docs),
        "sources": sources,
        "sample_entries": docs[:3]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8002)