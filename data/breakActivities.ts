export interface BreakActivity {
  id: string;
  type: 'puzzle' | 'joke' | 'brain-teaser';
  category?: 'qualitative' | 'quantitative' | 'analytical';
  title: string;
  content: string;
  answer?: string;
}

export const breakActivities: BreakActivity[] = [
  {
    id: 'joke-1',
    type: 'joke',
    title: '😂 Science Joke',
    content: 'Why can you never trust atoms?',
    answer: 'Because they make up everything!',
  },
  {
    id: 'joke-2',
    type: 'joke',
    title: '😂 Math Joke',
    content: 'Why was the equal sign so humble?',
    answer: "Because he knew he wasn't less than or greater than anyone else!",
  },
  {
    id: 'puzzle-1',
    type: 'puzzle',
    title: '🧩 Quick Puzzle',
    content: 'I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?',
    answer: 'An echo!',
  },
  {
    id: 'bt-qual-1',
    type: 'brain-teaser',
    category: 'qualitative',
    title: '🧠 Qualitative Teaser',
    content: 'A man walks into a restaurant and orders a water. The waiter pulls out a gun and points it at him. The man says "Thank you" and walks out. Why?',
    answer: 'The man had hiccups. The waiter scared them away!',
  },
  {
    id: 'bt-quant-1',
    type: 'brain-teaser',
    category: 'quantitative',
    title: '🔢 Quantitative Teaser',
    content: 'If 5 machines take 5 minutes to make 5 widgets, how long would 100 machines take to make 100 widgets?',
    answer: '5 minutes! Each machine makes one widget in 5 minutes.',
  },
  {
    id: 'bt-anal-1',
    type: 'brain-teaser',
    category: 'analytical',
    title: '🔍 Analytical Challenge',
    content: 'You have 8 balls. One is heavier. You have a balance scale. What is the minimum number of weighings needed to find the heavy ball?',
    answer: '2 weighings. Split into groups of 3-3-2.',
  },
];
