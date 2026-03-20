<?php

namespace App\Services;

use App\Models\ModerationCheck;
use App\Models\ModerationReport;
use App\Models\User;
use App\Models\UserComplianceTrack;
use App\Notifications\ViolationReported;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class ModerationEngine
{
    // Comprehensive keyword libraries
    private array $scientificTerms = [];
    private array $hateSpeechPatterns = [];
    private array $harassmentPatterns = [];
    private array $violencePatterns = [];
    private array $misinformationPatterns = [];
    private array $manipulatedMediaIndicators = [];
    private array $privacyViolations = [];
    private array $impersonationPatterns = [];
    private array $botIndicators = [];
    private array $coordinatedAttackPatterns = [];
    private array $ethnicTargetingTerms = [];
    private array $criminalityPatterns = [];
    private array $sexualContentPatterns = [];
    private array $educationalContext = [];
    private array $biologicalTerms = [];
    private array $medicalTerms = [];
    private array $academicSources = [];

    public function __construct()
    {
        $this->initializeKnowledgeBases();
    }

    /**
     * Initialize comprehensive knowledge bases
     */
    private function initializeKnowledgeBases(): void
    {
        // Scientific Terms (Biology, Medicine, Science)
        $this->scientificTerms = [
            'dna', 'rna', 'protein', 'enzyme', 'cell', 'tissue', 'organ', 'system',
            'evolution', 'natural selection', 'genetics', 'genome', 'chromosome',
            'mutation', 'adaptation', 'species', 'ecosystem', 'biodiversity',
            'photosynthesis', 'respiration', 'metabolism', 'homeostasis',
            'antibody', 'antigen', 'vaccine', 'immunity', 'pathogen', 'virus',
            'bacteria', 'fungus', 'parasite', 'microbe', 'microorganism',
            'neuron', 'synapse', 'neurotransmitter', 'brain', 'cortex',
            'hormone', 'endocrine', 'digestive', 'cardiovascular', 'respiratory',
            'reproduction', 'fertilization', 'embryo', 'fetus', 'gestation',
            'anatomy', 'physiology', 'biochemistry', 'molecular', 'cellular',
            'clinical', 'diagnosis', 'treatment', 'therapy', 'medication',
            'clinical trial', 'peer review', 'research', 'study', 'publication',
            'scientific method', 'hypothesis', 'experiment', 'data', 'analysis',
            'statistical significance', 'correlation', 'causation', 'evidence',
            'quantum', 'particle', 'atom', 'molecule', 'chemical', 'compound'
        ];

        // Hate Speech & Discrimination Patterns (Extreme Strictness)
        $this->hateSpeechPatterns = [
            '/\b(?:nigger|nigga|kike|spic|chink|gook|raghead|towelhead|cracker|wetback|beaner|coon|darkie)\b/i',
            '/\b(?:faggot|dyke|tranny|queer|homo|fairy|shemale|ladyboy)\b/i',
            '/\b(?:retard|mongoloid|spastic|cripple|handicapped|invalid|idiot|moron)\b/i',
            '/\b(?:whore|slut|tramp|prostitute|hooker|skank|bitch|cunt)\b/i',
            '/\b(?:terrorist|extremist|radical|jihadist|islamsit|sand-nigger)\b/i',
            '/\b(?:kill|exterminate|eliminate|remove|cleanse|burn)\s+(?:all|every|the)\s+(?:jews|muslims|blacks|whites|immigrants|gays|lgbt)\b/i',
            '/\b(?:white\s+supremacy|white\s+power|aryan|nazi|holocaust\s+denial|hitler\s+was\s+right)\b/i',
            '/\b(?:black\s+supremacy|black\s+power|kill\s+whites|cracker\s+kill)\b/i',
            '/\b(?:gender\s+ideology|trans\s+agenda|groomer|pedophelia\s+normalized)\b/i',
            '/\b(?:subhuman|vermin|parasite|scum|trash|filth)\s+(?:race|people|group)\b/i',
        ];

        // Harassment Patterns (Aggressive detection)
        $this->harassmentPatterns = [
            '/\b(?:stupid|idiot|moron|imbecile|fool|dumb|retarded|brainless|clown|joke)\b/i',
            '/\b(?:ugly|fat|disgusting|hideous|repulsive|gross|nasty|trash|garbage)\b/i',
            '/\b(?:worthless|useless|pathetic|loser|failure|disgrace|shame|poverty)\b/i',
            '/\b(?:kill\s+yourself|kys|suicide|die|hope\s+you\s+die|drop\s+dead|hang\s+yourself)\b/i',
            '/\b(?:stalk|follow|track|hunt|watch|find|dox|doxx)\s+(?:you|them|her|him|your\s+house)\b/i',
            '/\b(?:threat|danger|warning)\s+(?:to\s+kill|harm|hurt|destroy|ruin|end)\b/i',
            '/\b(?:rape|sexual\s+assault|molest|abuse|harass|violate|force)\b/i',
            '/\b(?:expose|leak|share|publicize)\s+(?:private|address|phone|nudes|photos)\b/i',
            '/\b(?:burn|stab|shoot|bomb|attack|punch|kick|hit|shove)\s+(?:you|them|house|place)\b/i',
        ];

        // Violence & Graphic Content (Zero Tolerance)
        $this->violencePatterns = [
            '/\b(?:murder|homicide|kill|execute|assassinate|slaughter|massacre)\b/i',
            '/\b(?:torture|maim|mutilate|dismember|behead|scalp|eviscerate)\b/i',
            '/\b(?:bomb|explosive|weapon|gun|knife|sword|rifle|pistol|ar15|glock)\b/i',
            '/\b(?:gore|blood|corpse|dead\s+body|dismemberment|splatter|brains)\b/i',
            '/\b(?:child\s+abuse|pedophile|pedophilia|cp|non-consensual)\b/i',
            '/\b(?:animal\s+cruelty|animal\s+abuse|torture\s+animals|kill\s+pets)\b/i',
            '/\b(?:suicide\s+method|how\s+to\s+kill\s+yourself|commit\s+suicide|pills|slapping\s+wrists)\b/i',
            '/\b(?:mass\s+shooting|school\s+shooting|terrorist\s+attack|active\s+shooter)\b/i',
        ];


        // Misinformation Patterns
        $this->misinformationPatterns = [
            '/\b(?:fake\s+news|hoax|conspiracy|cover\s+up|they\s+hide)\b/i',
            '/\b(?:vaccine\s+causes|covid\s+hoax|5g\s+causes|microchip)\b/i',
            '/\b(?:flat\s+earth|hollow\s+earth|moon\s+landing\s+hoax)\b/i',
            '/\b(?:chemtrail|geoengineering|weather\s+modification)\b/i',
            '/\b(?:new\s+world\s+order|illuminati|deep\s+state)\b/i',
            '/\b(?:election\s+fraud|stolen\s+election|voter\s+fraud)\b/i',
            '/\b(?:climate\s+change\s+hoax|global\s+warming\s+fake)\b/i',
        ];

        // Manipulated Media Indicators
        $this->manipulatedMediaIndicators = [
            'deepfake', 'ai generated', 'artificial intelligence created',
            'photoshopped', 'manipulated', 'edited', 'altered',
            'fake video', 'synthetic media', 'generative ai',
            'stable diffusion', 'midjourney', 'dall-e', 'face swap',
        ];

        // Privacy Violations
        $this->privacyViolations = [
            '/\b(?:\d{3}-\d{2}-\d{4}|\d{9})\b/', // SSN pattern
            '/\b(?:\d{3}[-.]?\d{3}[-.]?\d{4})\b/', // Phone pattern
            '/\b(?:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/', // Email pattern
            '/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/', // IP pattern
            '/\b(?:\d{5}(?:-\d{4})?)\b/', // ZIP pattern
            '/\b(?:private\s+info|personal\s+data|doxx|doxing)\b/i',
        ];

        // Impersonation Patterns
        $this->impersonationPatterns = [
            '/\b(?:im\s+(?:the\s+)?real|official|authentic)\s+(?:account|profile)/i',
            '/\b(?:pretend\s+to\s+be|posing\s+as|acting\s+as)\b/i',
            '/\b(?:fake\s+profile|clone\s+account|impersonator)\b/i',
            '/\b(?:not\s+(?:the\s+)?real|fraudulent|scam\s+account)\b/i',
        ];

        // Bot Activity Indicators (Stricter)
        $this->botIndicators = [
            'automated', 'bot', 'script', 'automation', 'hacking', 'cracker',
            'rapid posting', 'mass commenting', 'spam', 'ad', 'buy now',
            'duplicate content', 'repetitive pattern', 'proxy', 'vpn',
            'anonymous', 'fake account', 'temporary email',
        ];

        // Coordinated Attack Patterns (Stricter)
        $this->coordinatedAttackPatterns = [
            '/\b(?:attack|target|harass|bomb|raid|invade)\s+(?:together|as\s+group|coordinated|now|everyone)\b/i',
            '/\b(?:brigade|raid|invasion|swarm|wave|flood)\b/i',
            '/\b(?:mass\s+report|report\s+bomb|flag\s+wave|report\s+all)\b/i',
            '/\b(?:organize|plan|coordinate|discuss|group)\s+(?:against|target|them|him|her)\b/i',
        ];


        // Ethnic Targeting Terms
        $this->ethnicTargetingTerms = [
            'arab', 'muslim', 'jewish', 'black', 'white', 'asian',
            'hispanic', 'latinx', 'indian', 'pakistani', 'chinese',
            'african', 'european', 'mexican', 'middle eastern',
        ];
        
        // Criminal Activity Patterns
        $this->criminalityPatterns = [
            '/\b(?:illegal|crime|theft|robbery|stealing|burglary|fraud|scam|ponzi|embezzle)\b/i',
            '/\b(?:drug|narcotic|marijuana|weed|cocaine|heroin|meth|dealer|trafficking)\b/i',
            '/\b(?:terrorism|terrorist|extremism|radical|jihad|insurrection|bomb\s+making|weapon\s+sales)\b/i',
            '/\b(?:money\s+laundering|identity\s+theft|hacking|phishing|ransomware|malware)\b/i',
        ];

        // Sexual Content Patterns
        $this->sexualContentPatterns = [
            '/\b(?:sex|sexual|porn|pornography|nsfw|xxx|naked|nudity|nude|erotic|adult\s+content)\b/i',
            '/\b(?:blowjob|handjob|orgasm|ejaculation|cum|pussy|dick|penis|vagina|clitoris)\b/i',
            '/\b(?:strip|stripper|prostitute|escort|camshow|onlyfans|pedophilia|molest)\b/i',
        ];

        // Educational Context Indicators
        $this->educationalContext = [
            'study', 'research', 'paper', 'article', 'journal',
            'peer review', 'scientific', 'academic', 'university',
            'college', 'course', 'lecture', 'education', 'learning',
            'textbook', 'reference', 'citation', 'source',
        ];

        // Biological Terms (for scientific context)
        $this->biologicalTerms = [
            'anatomy', 'biology', 'physiology', 'reproduction', 'genetics',
            'evolution', 'development', 'growth', 'cells', 'tissues',
            'organs', 'systems', 'functions', 'processes', 'mechanisms',
        ];

        // Medical Terms
        $this->medicalTerms = [
            'health', 'disease', 'condition', 'syndrome', 'disorder',
            'treatment', 'therapy', 'medication', 'diagnosis', 'prognosis',
            'symptom', 'sign', 'clinical', 'medical', 'patient', 'doctor',
        ];

        // Academic Sources
        $this->academicSources = [
            'nature', 'science', 'cell', 'lancet', 'nejm', 'pubmed',
            'google scholar', 'researchgate', 'academia', 'arxiv',
        ];
    }

    /**
     * Enhanced content analysis with comprehensive pattern matching
     */
    public function analyzeContent(string $text, string $targetType, $targetId = null, bool $autoReport = true): ModerationCheck
    {
        $analysis = $this->performAdvancedAIAnalysis($text);

        // Detect context type (scientific/educational vs malicious)
        $contextType = $this->detectContentContext($text);

        // Adjust scores based on context (ONLY if malicious intent is not already extreme)
        if (($contextType === 'scientific' || $contextType === 'educational') && $analysis['malicious_intent_score'] < 0.8) {
            $analysis = $this->adjustForScientificContext($analysis, $text);
        }

        // Detect if this is a coordinated attack
        $isCoordinatedAttack = $this->detectCoordinatedAttack($text, $targetId);
        if ($isCoordinatedAttack) {
            $analysis['malicious_intent_score'] = max($analysis['malicious_intent_score'], 0.9);
            $analysis['flags'][] = 'coordinated_attack';
        }

        // Detect reporting bias patterns
        $biasAnalysis = $this->analyzeReportingBias($text);

        // Calculate severity score
        $severityScore = $this->calculateSeverityScore($analysis);

        // Store all extended data in ai_flags since we won't change the schema
        $aiFlags = array_merge($analysis['flags'] ?? [], [
            'context_type' => $contextType,
            'detected_patterns' => $analysis['detected_patterns'] ?? [],
            'severity_score' => $severityScore,
        ]);

        // If targetId is a UUID, store it in ai_flags since the column is BigInt
        if (!is_numeric($targetId)) {
            $aiFlags['actual_target_id'] = $targetId;
        }

        $check = ModerationCheck::create([
            'id' => (string)Str::uuid(),
            'target_type' => $targetType,
            'target_id' => is_numeric($targetId) ? $targetId : 0,
            'content_snapshot' => Str::limit($text, 500),
            'fact_score' => $analysis['fact_score'],
            'morality_score' => $analysis['morality_score'],
            'bias_score' => $biasAnalysis['bias_score'],
            'malicious_intent_score' => $analysis['malicious_intent_score'],
            'ai_flags' => $aiFlags,
            'recommended_action' => $this->recommendAdvancedAction($analysis, $contextType),
        ]);


        // Auto-moderation for critical violations
        if ($severityScore > 0.85 && !in_array('scientific_accuracy', $analysis['flags'])) {
            $this->autoModerate($check, $analysis);
        }

        // Auto-report for high severity (ONLY if requested and no report exists)
        if ($autoReport && $this->shouldAutoReport($check, $severityScore)) {
            $this->autoCreateAdvancedReport($check, $analysis, $severityScore);
        }

        return $check;
    }

    /**
     * Perform advanced AI analysis with comprehensive pattern detection
     */
    private function performAdvancedAIAnalysis(string $text): array
    {
        $lowerText = strtolower($text);

        // Initialize scores (Start much more strict)
        $maliciousScore = 0.0;
        $factScore = 0.4; // More skeptical
        $moralityScore = 0.6; // Start lower
        $flags = [];
        $detectedPatterns = [];

        // 1. Hate Speech Detection (Increased strictness)
        $hateScore = $this->detectHateSpeech($lowerText);
        if ($hateScore > 0) {
            $maliciousScore = max($maliciousScore, $hateScore + 0.15); // Significant boost
            $flags[] = 'hate_speech';
            $detectedPatterns[] = 'hate_speech_detected';
            $moralityScore -= $hateScore * 0.8;
        }

        // 2. Harassment & Insult Detection (Increased strictness)
        $harassmentScore = $this->detectHarassment($lowerText);
        if ($harassmentScore > 0) {
            $maliciousScore = max($maliciousScore, $harassmentScore + 0.15);
            $flags[] = 'harassment';
            $flags[] = 'targeted_insult';
            $detectedPatterns[] = 'harassment_detected';
            $moralityScore -= $harassmentScore * 0.7;
        }

        // 3. Violence Detection (Increased strictness)
        $violenceScore = $this->detectViolence($lowerText);
        if ($violenceScore > 0) {
            $maliciousScore = max($maliciousScore, $violenceScore + 0.1);
            $flags[] = 'violence';
            $detectedPatterns[] = 'violence_detected';
            $moralityScore -= $violenceScore * 0.9;
        }

        // 4. Misinformation Detection
        $misinfoScore = $this->detectMisinformation($lowerText);
        if ($misinfoScore > 0) {
            $factScore = max(0, $factScore - $misinfoScore);
            $flags[] = 'misinformation';
            $detectedPatterns[] = 'misinformation_detected';
        }

        // 5. Privacy Violation Detection
        $privacyScore = $this->detectPrivacyViolations($text);
        if ($privacyScore > 0) {
            $maliciousScore = max($maliciousScore, $privacyScore + 0.1);
            $flags[] = 'privacy';
            $detectedPatterns[] = 'pii_detected';
        }

        // 6. Impersonation Detection
        $impersonationScore = $this->detectImpersonation($lowerText);
        if ($impersonationScore > 0) {
            $maliciousScore = max($maliciousScore, $impersonationScore + 0.1);
            $flags[] = 'impersonation';
        }

        // 7. Scientific Accuracy Check
        $scientificScore = $this->checkScientificAccuracy($lowerText);
        if ($scientificScore > 0) {
            $factScore = min(1.0, $factScore + $scientificScore * 0.5);
            $flags[] = 'scientific_accuracy';
        }

        // 8. Educational Context Detection
        $educationalScore = $this->detectEducationalContext($lowerText);
        if ($educationalScore > 0) {
            $flags[] = 'educational_context';
            // Only reduce malicious score if it's not already extremely high (to prevent masking hate speech)
            if ($maliciousScore < 0.7) {
                $maliciousScore = max(0, $maliciousScore - $educationalScore * 0.2); 
            }
        }

        // 9. Bot Detection
        $botScore = $this->detectBotActivity($lowerText);
        if ($botScore > 0) {
            $maliciousScore = max($maliciousScore, $botScore + 0.1);
            $flags[] = 'bot_activity';
        }

        // 10. Coordinated Attack Detection
        $coordinatedScore = $this->detectCoordinatedAttackPatterns($lowerText);
        if ($coordinatedScore > 0) {
            $maliciousScore = max($maliciousScore, $coordinatedScore + 0.1);
            $flags[] = 'coordinated_attack';
        }

        // 11. Criminality Detection
        $criminalityScore = $this->detectCriminality($lowerText);
        if ($criminalityScore > 0) {
            $maliciousScore = max($maliciousScore, $criminalityScore + 0.1);
            $flags[] = 'criminality';
            $detectedPatterns[] = 'criminality_detected';
        }

        // 12. Sexual Content Detection
        $sexualScore = $this->detectSexualContent($lowerText);
        if ($sexualScore > 0) {
            $maliciousScore = max($maliciousScore, $sexualScore + 0.1);
            $flags[] = 'sexual_content';
            $detectedPatterns[] = 'sexual_content_detected';
        }

        // 13. Malicious Narrative / Bullying (Specific targeted subcategories)
        if (preg_match('/(attack|target|victim|harassment|bully|shame|stupid|idiot|trash|garbage|clown|rat|dog)/i', $lowerText) && $maliciousScore > 0.3) {
            $maliciousScore = max($maliciousScore, 0.8);
            $flags[] = 'bullying';
            $flags[] = 'malicious_narrative';
        }

        // Normalize scores
        $maliciousScore = min(1.0, max(0.0, $maliciousScore));
        $moralityScore = min(1.0, max(0.0, $moralityScore));
        $factScore = min(1.0, max(0.0, $factScore));

        return [
            'fact_score' => $factScore,
            'morality_score' => $moralityScore,
            'malicious_intent_score' => $maliciousScore,
            'flags' => array_unique($flags),
            'detected_patterns' => $detectedPatterns,
            'severity' => $this->classifySeverity($maliciousScore, $factScore),
        ];
    }


    /**
     * Detect hate speech patterns
     */
    private function detectHateSpeech(string $text): float
    {
        $maxScore = 0.0;
        foreach ($this->hateSpeechPatterns as $pattern) {
            if (preg_match($pattern, $text, $matches)) {
                $maxScore = max($maxScore, 0.98); // Increased from 0.95
                break;
            }
        }

        // Check for targeted ethnic slurs
        foreach ($this->ethnicTargetingTerms as $term) {
            if (stripos($text, $term) !== false) {
                // If the term is used alongside aggressive verbs or negative adjectives
                if (preg_match('/(kill|hate|trash|idiot|slave|ban|death|inferior|dirty|stupid)/i', $text)) {
                    $maxScore = max($maxScore, 1.0);
                } else {
                    $maxScore = max($maxScore, 0.6); // Flag even mention in some contexts
                }
            }
        }

        return $maxScore;
    }

    /**
     * Detect harassment patterns
     */
    private function detectHarassment(string $text): float
    {
        $score = 0.0;
        foreach ($this->harassmentPatterns as $pattern) {
            if (preg_match($pattern, $text)) {
                $score += 0.45; // Increased from 0.35
                if ($score >= 0.9) break;
            }
        }

        // Check for common insults
        if (preg_match('/(stupid|uGLY|fuc|idiot|retard|loser|trash|bitch|bastard)/i', $text)) {
            $score = max($score, 0.85);
        }

        return min(1.0, $score);
    }

    /**
     * Detect violence and graphic content
     */
    private function detectViolence(string $text): float
    {
        $score = 0.0;
        foreach ($this->violencePatterns as $pattern) {
            if (preg_match($pattern, $text)) {
                $score += 0.55; // Increased
                if ($score >= 0.9) break;
            }
        }

        if (preg_match('/(kill|murder|blood|death|shoot|stab|choke|bomb)/i', $text)) {
            $score = max($score, 0.95);
        }

        return min(1.0, $score);
    }

    /**
     * Detect misinformation patterns
     */
    private function detectMisinformation(string $text): float
    {
        $score = 0.0;
        foreach ($this->misinformationPatterns as $pattern) {
            if (preg_match($pattern, $text)) {
                $score += 0.45;
                if ($score >= 0.9) break;
            }
        }

        return min(0.9, $score);
    }

    /**
     * Detect privacy violations and PII
     */
    private function detectPrivacyViolations(string $text): float
    {
        $score = 0.0;
        foreach ($this->privacyViolations as $pattern) {
            if (preg_match($pattern, $text)) {
                $score += 0.7; // Increased
                if ($score >= 0.9) break;
            }
        }

        return min(1.0, $score);
    }

    /**
     * Detect impersonation attempts
     */
    private function detectImpersonation(string $text): float
    {
        $score = 0.0;
        foreach ($this->impersonationPatterns as $pattern) {
            if (preg_match($pattern, $text)) {
                $score += 0.5;
            }
        }

        return min(0.95, $score);
    }

    /**
     * Check scientific accuracy
     */
    private function checkScientificAccuracy(string $text): float
    {
        $count = 0;
        $sets = [$this->scientificTerms, $this->biologicalTerms, $this->medicalTerms, $this->academicSources];
        foreach ($sets as $set) {
            foreach ($set as $term) {
                if (stripos($text, $term) !== false) {
                    $count++;
                }
            }
        }

        if ($count > 4) return 0.98;
        if ($count > 2) return 0.8;
        if ($count > 0) return 0.6;

        return 0.0;
    }

    /**
     * Detect educational context
     */
    private function detectEducationalContext(string $text): float
    {
        $score = 0.0;
        foreach ($this->educationalContext as $term) {
            if (stripos($text, $term) !== false) {
                $score += 0.3;
            }
        }

        return min(1.0, $score);
    }

    /**
     * Detect bot activity patterns
     */
    private function detectBotActivity(string $text): float
    {
        $score = 0.0;
        foreach ($this->botIndicators as $indicator) {
            if (stripos($text, $indicator) !== false) {
                $score += 0.4;
            }
        }

        return min(0.95, $score);
    }

    /**
     * Detect coordinated attack patterns
     */
    private function detectCoordinatedAttackPatterns(string $text): float
    {
        $score = 0.0;
        foreach ($this->coordinatedAttackPatterns as $pattern) {
            if (preg_match($pattern, $text)) {
                $score += 0.7;
            }
        }

        return min(1.0, $score);
    }

    /**
     * Detect criminality patterns
     */
    private function detectCriminality(string $text): float
    {
        $score = 0.0;
        foreach ($this->criminalityPatterns as $pattern) {
            if (preg_match($pattern, $text)) {
                $score += 0.5;
                if ($score >= 0.9) break;
            }
        }
        return min(1.0, $score);
    }

    /**
     * Detect sexual content patterns
     */
    private function detectSexualContent(string $text): float
    {
        $score = 0.0;
        foreach ($this->sexualContentPatterns as $pattern) {
            if (preg_match($pattern, $text)) {
                $score += 0.5;
                if ($score >= 0.9) break;
            }
        }
        return min(1.0, $score);
    }

    /**
     * Detect content context (scientific, educational, malicious)
     */
    private function detectContentContext(string $text): string
    {
        $scientificScore = $this->checkScientificAccuracy($text);
        $educationalScore = $this->detectEducationalContext($text);
        
        // Malicious score here should be extremely strict
        $maliciousScore = max(
            $this->detectHateSpeech($text),
            $this->detectHarassment($text),
            $this->detectViolence($text)
        );

        if ($maliciousScore > 0.8) {
            return 'malicious';
        }

        if ($scientificScore > 0.7 || $educationalScore > 0.7) {
            return 'scientific';
        }

        return 'neutral';
    }

    /**
     * Adjust scores for scientific/educational content
     */
    private function adjustForScientificContext(array $analysis, string $text): array
    {
        // Reduced the reduction (was 0.6) - science shouldn't excuse extreme hate
        $reduction = 0.4; 
        
        $analysis['malicious_intent_score'] = max(0, $analysis['malicious_intent_score'] - $reduction);
        $analysis['fact_score'] = min(1.0, $analysis['fact_score'] + 0.25);

        // Still allow critical flags if malicious score is high even after reduction
        if ($analysis['malicious_intent_score'] < 0.5) {
            $analysis['flags'] = array_filter($analysis['flags'], function ($flag) {
                return !in_array($flag, ['critical_violation']);
            });
        }

        if (!in_array('scientific_accuracy', $analysis['flags'])) {
            $analysis['flags'][] = 'scientific_accuracy';
        }

        return $analysis;
    }

    /**
     * Analyze reporting bias
     */
    public function analyzeReportingBias(string $text): array
    {
        $biasScore = 0.0;
        $isProtected = false;

        $targetedGroups = [];
        foreach ($this->ethnicTargetingTerms as $term) {
            if (stripos($text, $term) !== false) {
                $targetedGroups[] = $term;
            }
        }

        if (count($targetedGroups) > 0) {
            $biasScore += 0.4 * min(3, count($targetedGroups));
        }

        if ($this->detectEducationalContext($text) > 0.8 &&
            ($this->detectHateSpeech($text) < 0.5 && $this->detectHarassment($text) < 0.5)) {
            $biasScore += 0.6;
            $isProtected = true;
        }

        return [
            'bias_score' => min(1.0, $biasScore),
            'is_protected' => $isProtected,
            'targeted_groups' => $targetedGroups,
        ];
    }

    /**
     * Detect coordinated attack
     */
    private function detectCoordinatedAttack(string $text, $targetId): bool
    {
        if (!$targetId) return false;

        $recentReports = ModerationReport::where('target_id', $targetId)
            ->where('created_at', '>=', now()->subHour())
            ->count();

        return $recentReports >= 3; // Reduced from 5 (stricter)
    }

    /**
     * Calculate severity score
     */
    private function calculateSeverityScore(array $analysis): float
    {
        $severity = 0.0;
        $severity += $analysis['malicious_intent_score'] * 0.65; // Weight increased
        $severity += (1 - $analysis['fact_score']) * 0.2;
        $severity += (1 - $analysis['morality_score']) * 0.15;

        return min(1.0, $severity);
    }

    /**
     * Classify severity level
     */
    private function classifySeverity(float $maliciousScore, float $factScore): string
    {
        if ($maliciousScore > 0.8) return 'critical'; // Lowered from 0.9 (stricter)
        if ($maliciousScore > 0.6) return 'high'; // Lowered from 0.75
        if ($factScore < 0.3) return 'medium';
        return 'low';
    }

    /**
     * Recommend advanced action based on analysis
     */
    private function recommendAdvancedAction(array $analysis, string $contextType): string
    {
        if ($analysis['malicious_intent_score'] > 0.8) {
            return 'urgent_removal';
        }

        if ($analysis['malicious_intent_score'] > 0.6) {
            return 'immediate_restriction';
        }

        return 'flag_for_review';
    }

    /**
     * Check if auto-report should be created
     */
    private function shouldAutoReport(ModerationCheck $check, float $severityScore): bool
    {
        // Don't auto-report if we already have many reports for this target
        $existingReportsCount = ModerationReport::where('target_id', $check->target_id)
            ->where('target_type', $check->target_type)
            ->where('created_at', '>=', now()->subMinutes(5))
            ->count();

        if ($existingReportsCount > 0) return false;

        return $check->malicious_intent_score > 0.6 || $severityScore > 0.6;
    }

    /**
     * Auto-create advanced report for background processing
     */
    private function autoCreateAdvancedReport(ModerationCheck $check, array $analysis, float $severityScore): void
    {
        $existing = ModerationReport::where('check_id', $check->id)->exists();
        if ($existing) return;

        $severity = $severityScore > 0.8 ? 'critical' : ($severityScore > 0.6 ? 'high' : 'medium');
        $category = $this->determineReportCategory($analysis['flags']);

        $metadata = [
            'ai_analysis' => [
                'fact_score' => $analysis['fact_score'],
                'morality_score' => $analysis['morality_score'],
                'malicious_intent_score' => $analysis['malicious_intent_score'],
                'scientific_accuracy' => $analysis['fact_score'], 
                'detected_patterns' => $analysis['detected_patterns'] ?? [],
                'flags' => $analysis['flags'],
            ],
            'auto_generated' => true,
            'system_version' => '2.5.0-shield'
        ];


        // If targetId is a UUID (from check), store it in metadata
        if (isset($check->ai_flags['actual_target_id'])) {
            $metadata['actual_target_id'] = $check->ai_flags['actual_target_id'];
        }

        $report = ModerationReport::create([
            'report_id' => 'SYS-' . Str::upper(Str::random(10)),
            'target_type' => $check->target_type,
            'target_id' => $check->target_id,
            'category' => $category,
            'subcategory' => $analysis['flags'][0] ?? 'ai_auto_flag',
            'description' => $this->generateReportDescription($check, $analysis),
            'severity' => $severity,
            'status' => 'pending',
            'check_id' => $check->id,
            'metadata' => $metadata,
        ]);


        // Notify admins (STRICTLY HIGH/CRITICAL)
        if ($severity === 'critical' || $severity === 'high') {
            $admins = User::where('is_admin', true)->get();
            foreach ($admins as $admin) {
                // Realtime check: Ensure we are using the primary notification class
                $admin->notify(new ViolationReported($report));
            }
        }
    }

    /**
     * Auto-moderate content (Soft/Hard deletion) for critical flags
     */
    private function autoModerate(ModerationCheck $check, array $analysis): void
    {
        Log::warning('AUTO-MODERATION TRIGGERED', [
            'target_type' => $check->target_type,
            'target_id' => $check->target_id,
            'reason' => $analysis['flags'][0] ?? 'Extreme toxicity'
        ]);
        
        // Implement immediate hidden status here if model supports it
    }

    /**
     * Determine report category based on flags (Aligned with ReportPost.tsx)
     */
    private function determineReportCategory(array $flags): string
    {
        if (array_intersect(['hate_speech', 'bullying', 'targeted_insult', 'malicious_narrative'], $flags)) {
            return 'ethical_violation';
        }
        if (array_intersect(['violence', 'privacy', 'impersonation'], $flags)) {
            return 'safety';
        }
        if (array_intersect(['misinformation', 'scientific_accuracy', 'manipulated_media'], $flags)) {
            return 'information_integrity';
        }
        if (array_intersect(['bot_activity', 'coordinated_attack'], $flags)) {
            return 'malicious_behavior';
        }
        if (in_array('criminality', $flags)) {
            return 'criminality';
        }
        if (in_array('sexual_content', $flags)) {
            return 'sexual_content';
        }

        return 'information_integrity';
    }

    /**
     * Generate detailed report description
     */
    private function generateReportDescription(ModerationCheck $check, array $analysis): string
    {
        $patterns = implode(', ', array_slice($analysis['detected_patterns'] ?? [], 0, 3));

        return sprintf(
            "Pure AI Moderation: %s\n" .
            "Malicious: %.0f%% | Fact: %.0f%% | Ethics: %.0f%%\n" .
            "Patterns: [%s]\n" .
            "Content: %s",
            str_replace('_', ' ', $check->recommended_action),
            $analysis['malicious_intent_score'] * 100,
            $analysis['fact_score'] * 100,
            $analysis['morality_score'] * 100,
            $patterns ?: 'AI_FLAG',
            $check->content_snapshot
        );
    }

    /**
     * Evaluate reporting bias with full context
     */
    public function evaluateReportingBias($reporterId, $targetId, $targetType): array
    {
        $compliance = UserComplianceTrack::firstOrCreate(['user_id' => $reporterId]);

        $reportsCount = ModerationReport::where('reporter_id', $reporterId)->count();
        $falseReports = ModerationReport::where('reporter_id', $reporterId)
            ->where('status', 'resolved') 
            ->count(); 

        $falseReportRate = $reportsCount > 0 ? $falseReports / $reportsCount : 0;

        $biasScore = 0.0;
        if ($falseReportRate > 0.3) $biasScore += 0.5;
        if ($compliance->trust_score < 0.5) $biasScore += 0.4;

        $targetReports = ModerationReport::where('reporter_id', $reporterId)
            ->where('target_id', $targetId)
            ->where('target_type', $targetType)
            ->count();

        if ($targetReports > 2) $biasScore += 0.5;

        $isProtected = $this->checkProtectedStatus($targetId, $targetType);

        $compliance->update([
            'reporting_integrity' => max(0, min(1, 1 - $biasScore))
        ]);

        return [
            'bias_score' => min(1.0, $biasScore),
            'is_protected' => $isProtected,
            'reports_count' => $reportsCount,
            'target_reports_count' => $targetReports,
        ];
    }

    /**
     * Check if target has protected status
     */
    private function checkProtectedStatus($targetId, $targetType): bool
    {
        if ($targetType === 'user') {
            $track = UserComplianceTrack::where('user_id', $targetId)->first();
            return $track ? !empty($track->protected_status) : false;
        }

        return false;
    }

    /**
     * Get comprehensive analysis for a piece of content (API Endpoint)
     */
    public function getComprehensiveAnalysis(string $text): array
    {
        $analysis = $this->performAdvancedAIAnalysis($text);
        $context = $this->detectContentContext($text);
        $bias = $this->analyzeReportingBias($text);

        return [
            'fact_score' => $analysis['fact_score'],
            'morality_score' => $analysis['morality_score'],
            'malicious_intent_score' => $analysis['malicious_intent_score'],
            'scientific_accuracy' => $analysis['fact_score'], 
            'flags' => $analysis['flags'],
            'context' => $context,
            'bias_analysis' => $bias,
            'recommendation' => $this->recommendAdvancedAction($analysis, $context),
            'severity' => $this->classifySeverity($analysis['malicious_intent_score'], $analysis['fact_score']),
        ];
    }
}