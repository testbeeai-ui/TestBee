import { NextRequest, NextResponse } from 'next/server';

const SUBJECT_PERSONAS: Record<string, { name: string; emoji: string; personality: string }> = {
    physics: {
        name: 'Physics Bot',
        emoji: '⚡',
        personality: `You are an expert, friendly Physics tutor for Indian high school and competitive exam students (Class 11–12, JEE, NEET, KCET). 
You explain concepts clearly with intuition first, then math. 
You use real-life Indian examples (e.g., cricket, trains, rockets). 
You point out common exam mistakes and give memory tricks.
Keep answers concise (3–5 sentences) unless asked to elaborate.`,
    },
    chemistry: {
        name: 'Chemistry Bot',
        emoji: '🧪',
        personality: `You are an expert, friendly Chemistry tutor for Indian high school and competitive exam students (Class 11–12, JEE, NEET, KCET).
You explain with analogies, reactions and mnemonics.
You use relatable examples from everyday life in India.
You highlight common mistakes students make in exams.
Keep answers concise (3–5 sentences) unless asked to elaborate.`,
    },
    math: {
        name: 'Math Bot',
        emoji: '📐',
        personality: `You are an expert, friendly Math tutor for Indian high school and competitive exam students (Class 11–12, JEE, KCET).
You break problems step by step, and always show the logic.
You give shortcut tricks for JEE/KCET.
You highlight common calculation mistakes.
Keep answers concise unless a worked example is needed.`,
    },
    biology: {
        name: 'Biology Bot',
        emoji: '🧬',
        personality: `You are an expert, friendly Biology tutor for Indian high school and competitive exam students (Class 11–12, NEET).
You explain processes with diagrams described in text, real-life analogies, and NEET patterns.
You use memory aids (mnemonics) to help retention.
Keep answers concise (3–5 sentences) unless asked to elaborate.`,
    },
};

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
    en: 'Respond in clear, simple English.',
    hi: 'Respond in Hindi (हिन्दी). Use simple, conversational Hindi.',
    kn: 'Respond in Kannada (ಕನ್ನಡ). Use simple, conversational Kannada.',
    ta: 'Respond in Tamil (தமிழ்). Use simple, conversational Tamil.',
    te: 'Respond in Telugu (తెలుగు). Use simple, conversational Telugu.',
};

export async function POST(req: NextRequest) {
    try {
        const { message, subject, topic, subtopic, language = 'en' } = await req.json();

        const apiKey = process.env.SARVAM_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: 'API key not configured. Please add SARVAM_API_KEY to .env' },
                { status: 503 }
            );
        }

        const persona = SUBJECT_PERSONAS[subject] ?? SUBJECT_PERSONAS.physics;
        const langInstruction = LANGUAGE_INSTRUCTIONS[language] ?? LANGUAGE_INSTRUCTIONS.en;

        const systemPrompt = `${persona.personality}

Current context:
- Subject: ${subject.charAt(0).toUpperCase() + subject.slice(1)}
- Topic: ${topic}
${subtopic ? `- Topic: ${subtopic}` : ''}

${langInstruction}

If the student asks in a regional language, respond in that language.
Always be encouraging and positive. End with a short motivational note or tip when appropriate.`;

        const response = await fetch('https://api.sarvam.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'sarvam-m',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message },
                ],
                temperature: 0.7,
                max_tokens: 512,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Sarvam AI error:', error);
            return NextResponse.json(
                { error: 'AI service temporarily unavailable. Please try again.' },
                { status: 502 }
            );
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content ?? 'Sorry, I could not generate a response. Please try again.';

        return NextResponse.json({ reply });
    } catch (err) {
        console.error('Subject chat error:', err);
        return NextResponse.json(
            { error: 'Something went wrong. Please try again.' },
            { status: 500 }
        );
    }
}
