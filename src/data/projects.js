// Case-study content. `scripts/build-pages.mjs` renders one page per project.
export const projects = [
  {
    slug: 'steel-commerce',
    shape: 1,
    accent: 'straw',
    title: ['Steel', 'E-Commerce'],
    label: 'Full-stack · Web + Android',
    year: '2026',
    summary:
      'A B2C and B2B marketplace for industrial steel (TMT bars, pipes, sheets and structural sections) that ships as a website and a signed Android app from one React codebase.',
    links: [
      { label: 'Visit live site', href: 'https://amk-steels.vercel.app' },
      { label: 'Source', href: 'https://github.com/Boovesh985/Steel-E-Commerce-platform' },
    ],
    stackShort: 'React 19 · Express 5 · PostgreSQL · Capacitor',
    cover: { src: '/img/steel-home.webp', alt: 'Steel e-commerce homepage with per-kilo pricing cards' },
    problem:
      "Buying steel usually means phone calls, WhatsApp price lists and rates that change every week. Buyers can't compare grades or check stock, and suppliers track orders by hand.",
    built:
      'A catalogue of 270+ real products with specifications, per-kilo pricing and live stock; cart, wishlist and order tracking from pending to delivered; Razorpay payments with automatic refunds on cancellation; and an admin panel for analytics, warehouse inventory and fulfilment.',
    flowTitle: 'Checkout across two databases',
    flow: [
      ['Validate the buyer', 'User and delivery address are checked against the auth database.'],
      ['Read the catalogue', 'Current prices and stock come from the separate catalogue database.'],
      ['Reserve stock', 'A conditional update reserves quantity only where available stock covers the order.'],
      ['Create the order', 'With stock held, the order is written to the auth database.'],
      ['Compensate on failure', 'If anything fails after reservation, the held stock is restored. A race never leaves phantom reservations.'],
    ],
    figures: [
      ['270+', 'real product listings'],
      ['2', 'isolated PostgreSQL databases'],
      ['15 min', 'access-token lifetime'],
      ['1', 'codebase for web and Android'],
    ],
    decisionsTitle: 'Decisions worth noting',
    decisions: [
      ['Split auth from catalogue', 'Credentials and payment data sit physically apart from the public catalogue, and catalogue reads scale without touching transactional writes.'],
      ['Rotate refresh tokens', 'Short-lived access tokens, 30-day refresh tokens that rotate on use, and Argon2id hashing that migrates older bcrypt hashes when users sign in.'],
      ['Verify every payment', 'Razorpay webhooks are checked with HMAC SHA-256 before an order is marked paid. Cancelling an order refunds it and restores inventory.'],
    ],
    gallery: [
      { src: '/img/steel-products.webp', alt: 'Product catalogue with steel pipe categories', caption: 'Catalogue and category navigation' },
      { src: '/img/steel-login.webp', alt: 'Sign-in page with Google sign-in', caption: 'Sign-in: email, Google or phone OTP' },
    ],
    stack: [
      ['Frontend', 'React 19, Vite, Tailwind CSS v4, Zustand, TanStack Query, React Router'],
      ['Backend', 'Node.js 20, Express 5, Prisma (two clients), Zod'],
      ['Data', 'PostgreSQL 16 on Neon, two databases'],
      ['Auth', 'JWT with rotation, Firebase Google Sign-In, phone OTP, reCAPTCHA v3'],
      ['Payments', 'Razorpay with HMAC-verified webhooks'],
      ['Messaging', 'Resend email, Fast2SMS OTP'],
      ['Mobile', 'Capacitor Android build'],
      ['Deploy', 'Vercel, Render, Neon'],
    ],
  },
  {
    slug: 'clinical-agents',
    shape: 2,
    accent: 'violet',
    title: ['Multi-Agent', 'Clinical Reasoning'],
    label: 'Agentic AI · Healthcare',
    year: '2026',
    summary:
      'Five LLM agents, orchestrated with LangGraph, that plan, research, review, refine and answer clinical questions, plus a cache that answers repeat questions instantly.',
    links: [{ label: 'View source', href: 'https://github.com/Boovesh985/multi_agent_llm' }],
    stackShort: 'LangGraph · FAISS · FastAPI · Mistral · Llama 3.3',
    cover: { src: '/img/agents-arch.webp', alt: 'Multi-agent clinical reasoning pipeline diagram', square: true },
    problem:
      'A single LLM call can answer a medical question confidently and wrongly. A clinical answer needs evidence behind it, a second look for safety, and a way to check that retrieval found the right sources.',
    built:
      "A LangGraph state graph of five specialised agents across two model providers, retrieval over 100+ curated medical documents, a semantic response cache, a FastAPI service that streams each agent's progress over SSE, and a benchmark that scores answers and retrieval separately.",
    flowTitle: 'How a question moves through the graph',
    flow: [
      ['Cache lookup', 'An exact hash match first, then a semantic match at 88% cosine similarity or higher. A hit returns immediately.'],
      ['Clinical Planner', 'Mistral breaks the question into differential-diagnosis steps.'],
      ['Medical Researcher', 'Llama 3.3 70B retrieves evidence from the FAISS index of medical documents.'],
      ['Medical Reviewer', 'Mistral scores clinical accuracy, drug interactions and safety out of 10.'],
      ['Clinical Refiner', 'Answers scoring under 7 are corrected and sent back for review, up to twice.'],
      ['Medical Advisor', 'Writes the final answer with a medical disclaimer, then stores it in the cache.'],
    ],
    figures: [
      ['5', 'specialised agents'],
      ['100+', 'curated medical documents'],
      ['18', 'medical specialties'],
      ['~60%', 'fewer inter-agent tokens'],
    ],
    decisionsTitle: 'Decisions worth noting',
    decisions: [
      ['Route models by role', 'Mistral plans and reviews; Llama 3.3 70B on NVIDIA NIM researches, refines and advises. Each agent has its own token budget.'],
      ['Compress agent-to-agent messages', 'Inspired by LatentMAS, intermediate messages are compressed, cutting about 60% of tokens. Only the advisor writes a full answer.'],
      ['Measure retrieval, not just answers', 'Precision@5, Recall@5, MRR and NDCG score what was retrieved. Keyword F1 and a safety check score what was said.'],
    ],
    gallery: [],
    stack: [
      ['Language', 'Python'],
      ['Orchestration', 'LangGraph, LangChain'],
      ['Models', 'Mistral AI, NVIDIA NIM (Llama 3.3 70B)'],
      ['Retrieval', 'FAISS, SentenceTransformers (all-MiniLM-L6-v2)'],
      ['Caching', 'Semantic response cache (CAG), SHA-256 prompt-prefix KV cache'],
      ['API', 'FastAPI with server-sent events'],
      ['Frontend', 'HTML, Three.js, GSAP'],
    ],
  },
  {
    slug: 'encrypted-ecg',
    shape: 3,
    accent: 'bronze',
    title: ['Encrypted', 'ECG Diagnosis'],
    label: 'Privacy-preserving ML · Cardiology',
    year: '2026',
    summary:
      "Arrhythmia classification on homomorphically encrypted ECG signals, explained with SHAP. The cloud never sees a patient's raw heartbeat.",
    links: [
      { label: 'Try the live demo', href: 'https://huggingface.co/spaces/Boovesh985/secure-ecg-analysis' },
      { label: 'Source', href: 'https://github.com/Boovesh985/privacy-preserving-ecg-diagnosis' },
    ],
    stackShort: 'TensorFlow · TenSEAL (CKKS) · SHAP · Streamlit',
    cover: { src: '/img/ecg-training.webp', alt: 'Training curves reaching 95.9% validation accuracy', paper: true },
    problem:
      "Cloud ECG analysis means sending a patient's raw cardiac signal to someone else's server. Encrypting it in transit isn't enough when the server has to decrypt it to run the model.",
    built:
      'A pipeline where the patient device encrypts each 187-sample heartbeat with CKKS, the server runs a 1D-CNN directly on the ciphertext, and only the device can decrypt the result. SHAP then attributes the prediction to 45 clinical ECG features a clinician can read.',
    flowTitle: 'The encrypted pipeline',
    flow: [
      ['Encrypt on the device', 'CKKS at 128-bit security (polynomial modulus 8192), about 340 KB of ciphertext per beat.'],
      ['Infer on ciphertext', "The CNN's convolutions are fused into matrix multiplications the server runs without decrypting."],
      ['Decrypt on the device', 'Logits become softmax probabilities across five AAMI classes: N, S, V, F and Q.'],
      ['Explain the result', 'SHAP ranks P-wave, QRS, ST-segment, RR-interval, statistical and wavelet features.'],
    ],
    figures: [
      ['95.66%', 'accuracy on MIT-BIH'],
      ['~420 ms', 'encrypt → infer → decrypt'],
      ['128-bit', 'CKKS security'],
      ['45', 'clinical features explained'],
    ],
    decisionsTitle: 'What the research adds',
    decisions: [
      ['Risk-adaptive encryption', 'Encryption strength follows clinical risk: 80-bit for normal beats, up to 192-bit for life-critical ventricular arrhythmias.'],
      ['Explanations under noise', 'SHAP rankings stay stable (ρ > 0.96) down to 5 dB SNR, the kind of noise wearable ECGs produce.'],
      ['Cross-dataset checks', 'Trained on MIT-BIH, tested on PTB-XL, measuring how explanations and encrypted accuracy hold up under domain shift. Extends Cenitta et al., IEEE Access 2025.'],
    ],
    gallery: [
      { src: '/img/ecg-confusion.webp', alt: 'Confusion matrix across five arrhythmia classes', caption: 'Confusion matrix, five classes', paper: true, wide: true },
      { src: '/img/ecg-dataset.webp', alt: 'MIT-BIH class distribution and example beats', caption: 'Dataset overview: class balance across MIT-BIH', paper: true, wide: true },
    ],
    stack: [
      ['Deep learning', 'TensorFlow / Keras 1D-CNN'],
      ['Encryption', 'TenSEAL (Microsoft SEAL), CKKS'],
      ['Explainability', 'SHAP DeepExplainer and KernelExplainer'],
      ['Data', 'MIT-BIH Arrhythmia, PTB-XL'],
      ['Demo', 'Streamlit on Hugging Face Spaces'],
      ['Tools', 'NumPy, scikit-learn, Matplotlib'],
    ],
  },
]
