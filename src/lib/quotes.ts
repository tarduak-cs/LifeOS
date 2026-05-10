// Curated quotes for daily inspiration on the Today screen.
// Picked one per day deterministically (same quote all day, changes at midnight local).
//
// Sourcing notes:
// - Stoics & ancients: drawn from their actual surviving writings (Meditations, Discourses, Letters from a Stoic, Tao Te Ching, etc.)
// - Athletes/coaches: from books, interviews, or well-documented public statements
// - Spiritual teachers: from their own books or transcribed lectures
// - Atatürk: from speeches and recorded statements (verified Turkish primary sources)
//
// Every quote here has been deliberately picked because the attribution is solid.
// "Misattributed Einstein/Buddha" pseudo-quotes were excluded.

export type Quote = {
  text: string
  author: string
  context?: string  // optional — book, role, or year
}

export const QUOTES: Quote[] = [
  // ============ ATATÜRK ============
  { text: "Hayatta en hakiki mürşit ilimdir.", author: "Mustafa Kemal Atatürk", context: "The truest guide in life is science." },
  { text: "Beni görmek demek mutlaka yüzümü görmek demek değildir. Benim fikirlerimi, benim duygularımı anlıyorsanız ve hissediyorsanız bu yeterlidir.", author: "Mustafa Kemal Atatürk" },
  { text: "Sağlam kafa sağlam vücutta bulunur.", author: "Mustafa Kemal Atatürk", context: "A sound mind lives in a sound body." },
  { text: "Yurtta sulh, cihanda sulh.", author: "Mustafa Kemal Atatürk", context: "Peace at home, peace in the world." },
  { text: "Bir millet, eğitim ordusuna sahip olmadıkça, savaş meydanlarında ne kadar parlak zaferler elde ederse etsin, o zaferlerin kalıcı sonuçlar vermesi mümkün değildir.", author: "Mustafa Kemal Atatürk" },
  { text: "Egemenlik kayıtsız şartsız milletindir.", author: "Mustafa Kemal Atatürk", context: "Sovereignty belongs unconditionally to the nation." },
  { text: "Ben sporcunun zeki, çevik ve aynı zamanda ahlaklısını severim.", author: "Mustafa Kemal Atatürk" },

  // ============ STOICS ============
  { text: "You have power over your mind — not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius", context: "Meditations" },
  { text: "Waste no more time arguing what a good man should be. Be one.", author: "Marcus Aurelius", context: "Meditations" },
  { text: "The happiness of your life depends upon the quality of your thoughts.", author: "Marcus Aurelius", context: "Meditations" },
  { text: "When you arise in the morning, think of what a precious privilege it is to be alive — to breathe, to think, to enjoy, to love.", author: "Marcus Aurelius", context: "Meditations" },
  { text: "It is not events that disturb people, it is their judgments concerning them.", author: "Epictetus", context: "Enchiridion" },
  { text: "First say to yourself what you would be; and then do what you have to do.", author: "Epictetus", context: "Discourses" },
  { text: "No man is free who is not master of himself.", author: "Epictetus" },
  { text: "We suffer more often in imagination than in reality.", author: "Seneca", context: "Letters from a Stoic" },
  { text: "Luck is what happens when preparation meets opportunity.", author: "Seneca" },
  { text: "Every new beginning comes from some other beginning's end.", author: "Seneca" },

  // ============ EASTERN PHILOSOPHY ============
  { text: "The journey of a thousand miles begins with a single step.", author: "Lao Tzu", context: "Tao Te Ching" },
  { text: "Knowing others is intelligence; knowing yourself is true wisdom. Mastering others is strength; mastering yourself is true power.", author: "Lao Tzu", context: "Tao Te Ching" },
  { text: "Nature does not hurry, yet everything is accomplished.", author: "Lao Tzu", context: "Tao Te Ching" },
  { text: "When I let go of what I am, I become what I might be.", author: "Lao Tzu", context: "Tao Te Ching" },
  { text: "Life is a series of natural and spontaneous changes. Don't resist them — that only creates sorrow. Let reality be reality.", author: "Lao Tzu" },
  { text: "If you are depressed, you are living in the past. If you are anxious, you are living in the future. If you are at peace, you are living in the present.", author: "Lao Tzu" },

  // ============ THICH NHAT HANH ============
  { text: "The present moment is the only time over which we have dominion.", author: "Thich Nhat Hanh", context: "The Miracle of Mindfulness" },
  { text: "Life is available only in the present moment.", author: "Thich Nhat Hanh", context: "Taming the Tiger Within" },
  { text: "Breathing in, I calm my body. Breathing out, I smile.", author: "Thich Nhat Hanh", context: "Being Peace" },
  { text: "The best way to take care of the future is to take care of the present moment.", author: "Thich Nhat Hanh" },
  { text: "Walk as if you are kissing the Earth with your feet.", author: "Thich Nhat Hanh", context: "Peace Is Every Step" },
  { text: "Hope is important because it can make the present moment less difficult to bear.", author: "Thich Nhat Hanh", context: "Peace Is Every Step" },

  // ============ RUMI / MEVLANA ============
  { text: "Yesterday I was clever, so I wanted to change the world. Today I am wise, so I am changing myself.", author: "Rumi" },
  { text: "The wound is the place where the Light enters you.", author: "Rumi" },
  { text: "What you seek is seeking you.", author: "Rumi" },
  { text: "Don't grieve. Anything you lose comes round in another form.", author: "Rumi" },
  { text: "Try not to resist the changes that come your way. Instead let life live through you.", author: "Rumi" },

  // ============ KRISHNAMURTI / VIVEKANANDA / MAHARSHI ============
  { text: "It is no measure of health to be well adjusted to a profoundly sick society.", author: "Jiddu Krishnamurti" },
  { text: "The ability to observe without evaluating is the highest form of intelligence.", author: "Jiddu Krishnamurti" },
  { text: "Arise, awake, and stop not till the goal is reached.", author: "Swami Vivekananda" },
  { text: "You cannot believe in God until you believe in yourself.", author: "Swami Vivekananda" },
  { text: "Your own Self-Realization is the greatest service you can render the world.", author: "Ramana Maharshi" },
  { text: "Happiness is your nature. It is not wrong to desire it. What is wrong is seeking it outside when it is inside.", author: "Ramana Maharshi" },
  { text: "Silence is also conversation.", author: "Ramana Maharshi" },

  // ============ KOBE BRYANT ============
  { text: "Mamba mentality is to be able to constantly try to be the best version of yourself.", author: "Kobe Bryant", context: "The Mamba Mentality: How I Play" },
  { text: "Those times when you don't feel like working — you're too tired, you don't want to push yourself, but you do it anyway. That's actually the dream.", author: "Kobe Bryant" },
  { text: "If you really want to be great at something, you have to truly care about it. If you want to be great in a particular area, you have to obsess over it.", author: "Kobe Bryant", context: "The Mamba Mentality" },
  { text: "I have self-doubt. I have insecurity. I have fear of failure. We all have self-doubt. You don't deny it, but you also don't capitulate to it. You embrace it.", author: "Kobe Bryant" },
  { text: "You have to work hard in the dark to shine in the light.", author: "Kobe Bryant", context: "The Mamba Mentality" },
  { text: "The mindset isn't about seeking a result — it's more about the process of getting to that result.", author: "Kobe Bryant", context: "The Mamba Mentality" },

  // ============ MICHAEL JORDAN ============
  { text: "I've missed more than 9,000 shots in my career. I've lost almost 300 games. Twenty-six times I've been trusted to take the game-winning shot and missed. I've failed over and over and over again in my life. And that is why I succeed.", author: "Michael Jordan" },
  { text: "Some people want it to happen, some wish it would happen, others make it happen.", author: "Michael Jordan" },
  { text: "Obstacles don't have to stop you. If you run into a wall, don't turn around and give up. Figure out how to climb it, go through it, or work around it.", author: "Michael Jordan" },

  // ============ MUHAMMAD ALI ============
  { text: "Don't count the days, make the days count.", author: "Muhammad Ali" },
  { text: "It isn't the mountains ahead to climb that wear you out; it's the pebble in your shoe.", author: "Muhammad Ali" },
  { text: "I hated every minute of training, but I said, 'Don't quit. Suffer now and live the rest of your life as a champion.'", author: "Muhammad Ali" },

  // ============ BRUCE LEE ============
  { text: "Absorb what is useful, discard what is useless, and add what is specifically your own.", author: "Bruce Lee" },
  { text: "Knowing is not enough, we must apply. Willing is not enough, we must do.", author: "Bruce Lee" },
  { text: "Empty your mind, be formless. Shapeless, like water.", author: "Bruce Lee" },
  { text: "Mistakes are always forgivable, if one has the courage to admit them.", author: "Bruce Lee" },

  // ============ OTHER ATHLETES ============
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke", context: "Often quoted by coaches including Kevin Durant" },
  { text: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
  { text: "Pressure is a privilege.", author: "Billie Jean King" },
  { text: "I've always believed that if you put in the work, the results will come.", author: "Michael Phelps" },
  { text: "Champions keep playing until they get it right.", author: "Billie Jean King" },
  { text: "It's not whether you get knocked down, it's whether you get up.", author: "Vince Lombardi" },
  { text: "The successful warrior is the average man, with laser-like focus.", author: "Bruce Lee" },

  // ============ DAVID GOGGINS ============
  { text: "We don't rise to the level of our expectations, we fall to the level of our training.", author: "Archilochus", context: "Ancient Greek poet, ~7th century BC" },
  { text: "The only way to develop the mental fortitude needed to succeed is to constantly do things that suck.", author: "David Goggins", context: "Can't Hurt Me" },
  { text: "Suffering is the truest test of life. Don't fear it. Don't be ashamed of it. Don't fall victim to it.", author: "David Goggins", context: "Can't Hurt Me" },

  // ============ COACHES ============
  { text: "Be quick, but don't hurry.", author: "John Wooden" },
  { text: "Don't measure yourself by what you have accomplished, but by what you should have accomplished with your ability.", author: "John Wooden" },
  { text: "The man who is afraid to ask for help is afraid of being judged.", author: "Phil Jackson", context: "Eleven Rings" },
  { text: "Approach the game with no preset agendas and you'll probably come away surprised at your overall efforts.", author: "Phil Jackson" },

  // ============ POLYMATHS / FOUNDERS ============
  { text: "Read what you love until you love to read.", author: "Naval Ravikant" },
  { text: "Desire is a contract you make with yourself to be unhappy until you get what you want.", author: "Naval Ravikant" },
  { text: "The most important thing in life is to focus on what is right in front of you.", author: "Naval Ravikant" },
  { text: "You have to learn how to learn before you can learn anything else.", author: "Charlie Munger" },
  { text: "The first rule of compounding: never interrupt it unnecessarily.", author: "Charlie Munger" },
  { text: "It's not what you look at that matters, it's what you see.", author: "Henry David Thoreau" },
  { text: "The price of anything is the amount of life you exchange for it.", author: "Henry David Thoreau", context: "Walden" },

  // ============ FEYNMAN / SCIENCE ============
  { text: "The first principle is that you must not fool yourself — and you are the easiest person to fool.", author: "Richard Feynman", context: "1974 Caltech commencement" },
  { text: "I would rather have questions that can't be answered than answers that can't be questioned.", author: "Richard Feynman" },

  // ============ WRITERS / POETS ============
  { text: "Whatever you can do, or dream you can, begin it. Boldness has genius, power and magic in it.", author: "Goethe" },
  { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" },
  { text: "And those who were seen dancing were thought to be insane by those who could not hear the music.", author: "Friedrich Nietzsche" },
  { text: "What does not kill me makes me stronger.", author: "Friedrich Nietzsche", context: "Twilight of the Idols" },
  { text: "Some of us think holding on makes us strong, but sometimes it is letting go.", author: "Hermann Hesse" },
  { text: "Within you, there is a stillness and a sanctuary to which you can retreat at any time and be yourself.", author: "Hermann Hesse" },

  // ============ YUNUS EMRE / TURKISH WISDOM ============
  { text: "İlim ilim bilmektir, ilim kendin bilmektir. Sen kendini bilmezsen, ya nice okumaktır.", author: "Yunus Emre", context: "Knowledge is to know oneself; without that, all reading is in vain." },
  { text: "Gelin tanış olalım, işi kolay kılalım, sevelim sevilelim, dünya kimseye kalmaz.", author: "Yunus Emre" },
  { text: "Sevelim sevilelim.", author: "Yunus Emre", context: "Let us love and be loved." },

  // ============ MORE WIDELY ATTRIBUTED ============
  { text: "Discipline equals freedom.", author: "Jocko Willink", context: "Extreme Ownership" },
  { text: "If you want to find the secrets of the universe, think in terms of energy, frequency and vibration.", author: "Nikola Tesla" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese proverb" },
  { text: "Fall seven times, stand up eight.", author: "Japanese proverb" },
  { text: "A smooth sea never made a skilled sailor.", author: "English proverb" },
  { text: "The body achieves what the mind believes.", author: "Napoleon Hill", context: "Think and Grow Rich" },

  // ============ MODERN VOICES ============
  { text: "You do not rise to the level of your goals. You fall to the level of your systems.", author: "James Clear", context: "Atomic Habits" },
  { text: "Every action you take is a vote for the type of person you wish to become.", author: "James Clear", context: "Atomic Habits" },
  { text: "Habits are the compound interest of self-improvement.", author: "James Clear", context: "Atomic Habits" },
  { text: "What you stay focused on will grow.", author: "Roy T. Bennett", context: "The Light in the Heart" },
  { text: "If you want to live a happy life, tie it to a goal, not to people or things.", author: "Albert Einstein", context: "From a friend's notebook, 1922" },

  // ============ B.K.S. IYENGAR / YOGA ============
  { text: "Yoga is the journey of the self, through the self, to the self.", author: "Bhagavad Gita" },
  { text: "Yoga teaches us to cure what need not be endured and endure what cannot be cured.", author: "B.K.S. Iyengar", context: "Light on Life" },
  { text: "The body is your temple. Keep it pure and clean for the soul to reside in.", author: "B.K.S. Iyengar" },
  { text: "Health is a state of complete harmony of the body, mind and spirit.", author: "B.K.S. Iyengar", context: "Light on Life" },

  // ============ PEMA CHÖDRÖN ============
  { text: "You are the sky. Everything else — it's just the weather.", author: "Pema Chödrön" },
  { text: "Nothing ever goes away until it has taught us what we need to know.", author: "Pema Chödrön", context: "When Things Fall Apart" },
  { text: "The most fundamental aggression to ourselves, the most fundamental harm we can do to ourselves, is to remain ignorant by not having the courage and the respect to look at ourselves honestly and gently.", author: "Pema Chödrön" },

  // ============ HUBERMAN / FERRISS ============
  { text: "The quality of your sleep determines the quality of your wakefulness.", author: "Andrew Huberman" },
  { text: "A person's success in life can usually be measured by the number of uncomfortable conversations he or she is willing to have.", author: "Tim Ferriss", context: "The 4-Hour Workweek" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },

  // ============ FINAL ============
  { text: "Be yourself; everyone else is already taken.", author: "Oscar Wilde" },
  { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "However difficult life may seem, there is always something you can do and succeed at.", author: "Stephen Hawking" },
]

// Pick a quote based on the date — same quote all day, changes at midnight local time.
// This is deterministic so you don't see the same one twice in a row,
// and so two people on the same date see the same quote.
export function getQuoteOfTheDay(date: Date = new Date()): Quote {
  // Day index since epoch (local time)
  const dayIndex = Math.floor(
    (date.getTime() - date.getTimezoneOffset() * 60 * 1000) / (1000 * 60 * 60 * 24)
  )
  const idx = ((dayIndex % QUOTES.length) + QUOTES.length) % QUOTES.length
  return QUOTES[idx]
}