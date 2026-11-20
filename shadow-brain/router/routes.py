"""Route definitions Laya chooses between. Laya reads these
descriptions on every request, so clearer wording = better routing."""

ROUTES = {
    "chat": "casual conversation, greetings, questions about Shadow itself, advice, or explaining something from general knowledge, with no files, code, commands or web needed",
    "coding": "programs and scripts: writing, running, testing, debugging or changing code",
        "files": "files and folders on this computer: finding, reading, organizing, or creating documents, lists, JSON or CSV data that are not programs",
    "system": "this computer itself: opening apps, running terminal commands, or checking RAM, CPU, disk or battery",
    "health": "the user's own body and fitness data from their Fitbit band: steps, heart rate, sleep, calories, workouts, HRV, blood oxygen, or how active or rested they have been",
    "research": "anything the user asks to search or look up, current information, news, prices, documentation, or facts about a specific named product, model or person",
}

QUESTIONS = {
    "route": {
        "type": "choice",
        "instructions": "Which kind of help does the user need for their current message?",
        "criteria": ROUTES,
    }
}
