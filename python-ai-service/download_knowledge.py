import json
import requests
import os

def download_prebuilt_knowledge():
    """Download a pre-built knowledge base"""
    
    # URL to a sample knowledge base (you can replace this with any JSON URL)
    knowledge_data = [
        {
            "text": "Artificial Intelligence (AI) refers to the simulation of human intelligence in machines that are programmed to think and learn like humans, including capabilities like problem-solving, pattern recognition, and decision-making.",
            "source": "ai-definition"
        },
        {
            "text": "Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data without being explicitly programmed for every task, using algorithms that improve automatically through experience.",
            "source": "ml-definition"
        },
        {
            "text": "Quantum computing uses quantum bits or qubits which can exist in multiple states simultaneously through superposition, enabling them to solve certain problems much faster than classical computers for specific applications like cryptography and optimization.",
            "source": "quantum-computing"
        },
        {
            "text": "Genetics is the study of genes, genetic variation, and heredity in living organisms. DNA contains the genetic instructions used in the development and functioning of all known living organisms and viruses.",
            "source": "genetics"
        },
        {
            "text": "Climate change refers to long-term shifts in temperatures and weather patterns, primarily caused by human activities like burning fossil fuels which increase greenhouse gas concentrations in the atmosphere leading to global warming.",
            "source": "climate-change"
        },
        {
            "text": "The Internet is a global network of interconnected computers that communicate using standardized protocols, enabling worldwide connectivity and access to information through services like the World Wide Web, email, and file sharing.",
            "source": "internet"
        },
        {
            "text": "Renewable energy comes from natural sources that are constantly replenished, including solar power from sunlight, wind energy, hydropower from water, geothermal energy from earth's heat, and biomass from organic materials.",
            "source": "renewable-energy"
        },
        {
            "text": "Blockchain is a distributed, decentralized digital ledger that records transactions across many computers in a way that ensures security, transparency, and immutability of the recorded data, originally developed for cryptocurrencies like Bitcoin.",
            "source": "blockchain"
        },
        {
            "text": "Neural networks are computing systems inspired by biological neural networks in animal brains, consisting of interconnected nodes that process information and learn to perform tasks by analyzing examples, widely used in deep learning applications.",
            "source": "neural-networks"
        },
        {
            "text": "The human brain contains approximately 86 billion neurons that communicate through electrical and chemical signals, forming complex networks that enable thought, memory, consciousness, and all cognitive functions.",
            "source": "human-brain"
        },
        {
            "text": "Photosynthesis is the process used by plants, algae, and some bacteria to convert light energy into chemical energy that can be released to fuel the organisms' activities through cellular respiration, producing oxygen as a byproduct.",
            "source": "photosynthesis"
        },
        {
            "text": "Black holes are regions of spacetime where gravity is so strong that nothing—no particles or even electromagnetic radiation such as light—can escape from it, formed when massive stars collapse at the end of their life cycles.",
            "source": "black-holes"
        },
        {
            "text": "Virtual Reality (VR) creates simulated environments that users can interact with using special electronic equipment like headsets, while Augmented Reality (AR) overlays digital information onto the real world through devices like smartphones or smart glasses.",
            "source": "virtual-reality"
        },
        {
            "text": "The solar system consists of the Sun and eight planets: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune, along with their moons, asteroids, comets, dwarf planets, and other celestial bodies orbiting the Sun.",
            "source": "solar-system"
        },
        {
            "text": "DNA (deoxyribonucleic acid) is the molecule that carries genetic instructions in all living organisms, consisting of two strands that coil around each other to form a double helix containing four chemical bases: adenine, thymine, cytosine, and guanine.",
            "source": "dna"
        }
    ]
    
    # Save to knowledge.json
    with open("knowledge.json", "w", encoding="utf-8") as f:
        json.dump(knowledge_data, f, indent=2, ensure_ascii=False)
    
    print(f"Created knowledge.json with {len(knowledge_data)} entries")
    return knowledge_data

if __name__ == "__main__":
    download_prebuilt_knowledge()