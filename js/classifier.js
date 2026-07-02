// Simple, dependency-free Naive Bayes Text Classifier in Vanilla JS
// Used for on-device automatic categorization of expense descriptions

export class NaiveBayesClassifier {
    constructor() {
        this.categories = new Set();
        this.tokenCount = {};     // { categoryId: { token: count } }
        this.categoryCount = {};  // { categoryId: docCount }
        this.totalDocs = 0;
    }

    tokenize(text) {
        if (!text) return [];
        return String(text)
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(t => t.trim().length > 1);
    }

    train(text, categoryId) {
        if (!text || !categoryId) return;
        const tokens = this.tokenize(text);
        if (tokens.length === 0) return;

        if (!this.categoryCount[categoryId]) {
            this.categoryCount[categoryId] = 0;
            this.tokenCount[categoryId] = {};
        }
        this.categoryCount[categoryId]++;
        this.totalDocs++;
        this.categories.add(categoryId);

        tokens.forEach(token => {
            this.tokenCount[categoryId][token] = (this.tokenCount[categoryId][token] || 0) + 1;
        });
    }

    predict(text) {
        if (this.totalDocs === 0 || this.categories.size === 0) return null;
        const tokens = this.tokenize(text);
        if (tokens.length === 0) return null;

        let bestCategory = null;
        let maxScore = -Infinity;

        this.categories.forEach(categoryId => {
            // Prior probability: P(Category)
            let score = Math.log(this.categoryCount[categoryId] / this.totalDocs);

            // Sum of all token counts in this category
            const catTokenCounts = this.tokenCount[categoryId];
            const catTotalTokens = Object.values(catTokenCounts).reduce((sum, val) => sum + val, 0);

            tokens.forEach(token => {
                const count = catTokenCounts[token] || 0;
                // Laplace smoothing with vocabulary approximation size
                const probability = (count + 1) / (catTotalTokens + 1000);
                score += Math.log(probability);
            });

            if (score > maxScore) {
                maxScore = score;
                bestCategory = categoryId;
            }
        });

        return bestCategory;
    }
}
