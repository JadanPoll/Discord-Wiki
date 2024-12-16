
from transformers import pipeline
# Load a pre-trained model for the task
model = pipeline( "question-answering")


passages = [
    """Climate change refers to long-term shifts in temperatures and weather patterns. These changes may be natural, such as through variations in the solar cycle. However, since the 1800s, human activities have been the main driver of climate change, primarily due to burning fossil fuels like coal, oil, and gas.""",
    """Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to the natural intelligence displayed by humans and animals. Leading AI textbooks define the field as the study of "intelligent agents": any device that perceives its environment and takes actions that maximize its chance of successfully achieving its goals.""",
    """Quantum mechanics is a fundamental theory in physics that provides a description of the physical properties of nature at the scale of atoms and subatomic particles. It is the foundation of modern physics and describes phenomena that classical physics cannot explain.""",
    """The Great Wall of China is a series of fortifications that were built across the historical northern borders of China. The wall was constructed to protect Chinese states and empires against the raids and invasions of the nomadic groups of the Eurasian Steppe.""",
    """Blockchain is a decentralized ledger of all transactions across a network. Using this technology, participants can confirm transactions without needing a central clearing authority. Applications of blockchain include cryptocurrency, smart contracts, and supply chain management.""",
    """Photosynthesis is a process used by plants, algae, and some bacteria to convert light energy into chemical energy stored in glucose. This process is essential for life on Earth as it provides oxygen as a byproduct.""",
    """The Roman Empire was one of the most influential civilizations in history, known for its advances in architecture, engineering, law, and governance. The empire was centered in Rome and spanned the Mediterranean region, leaving a legacy that shaped Western civilization.""",
    """Cybersecurity involves protecting systems, networks, and programs from digital attacks. These attacks are usually aimed at accessing, changing, or destroying sensitive information; extorting money from users; or disrupting normal business processes.""",
    """Machine learning is a subset of artificial intelligence that allows systems to learn and improve from experience without being explicitly programmed. It focuses on the development of algorithms that can process large amounts of data and make predictions or decisions.""",
    """Shakespeare's plays are considered some of the greatest works in the English language. His tragedies, comedies, and histories have been performed for centuries and continue to influence literature and the arts worldwide."""
]



import time
for text in passages:
    start=time.time()

    result = model(question="Give a good specific descriptive topic for this passage", context=text)['answer']
    print(f"Alternative topic: {result}")
    print(f"Time Elapsed:{time.time()-start}")


