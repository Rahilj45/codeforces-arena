// seed_problems.js
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase Client
// Replace with your actual project URL and Service Role Key
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function seedProblems() {
    try {
        console.log('Fetching problems from Codeforces API...');
        const response = await fetch('https://codeforces.com/api/problemset.problems');
        const data = await response.json();

        if (data.status !== 'OK') {
            throw new Error(`Codeforces API returned status: ${data.status}`);
        }

        const { problems, problemStatistics } = data.result;

        // Map solve counts by problem ID (contestId-index) for quick lookup
        const statsMap = new Map();
        for (const stat of problemStatistics) {
            const problemId = `${stat.contestId}-${stat.index}`;
            statsMap.set(problemId, stat.solvedCount);
        }

        const problemsToInsert = [];

        for (const problem of problems) {
            const problemId = `${problem.contestId}-${problem.index}`;
            const solveCount = statsMap.get(problemId) || 0;

            // Filter out obscure/unsolved problems to ensure high quality matches
            if (solveCount >= 500) {
                problemsToInsert.push({
                    problem_id: problemId,
                    name: problem.name,
                    // Note: Some CF problems (like April Fools) don't have ratings.
                    rating: problem.rating || null,
                    solve_count: solveCount
                });
            }
        }

        console.log(`Found ${problemsToInsert.length} problems with >= 500 solves. Preparing to insert...`);

        // Supabase bulk upsert - chunking is recommended for large datasets (e.g. 9000 rows)
        const CHUNK_SIZE = 1000;
        for (let i = 0; i < problemsToInsert.length; i += CHUNK_SIZE) {
            const chunk = problemsToInsert.slice(i, i + CHUNK_SIZE);
            const { error } = await supabase
                .from('problems')
                .upsert(chunk, { onConflict: 'problem_id' });

            if (error) {
                console.error(`Error inserting chunk ${Math.floor(i / CHUNK_SIZE) + 1}:`, error);
            } else {
                console.log(`Successfully inserted chunk ${Math.floor(i / CHUNK_SIZE) + 1} (${chunk.length} problems).`);
            }
        }

        console.log('Seeding complete!');
    } catch (error) {
        console.error('Error in seeder script:', error);
    }
}

seedProblems();
