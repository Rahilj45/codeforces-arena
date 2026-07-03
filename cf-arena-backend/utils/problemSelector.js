const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

async function getUniqueRoomProblems(playerHandlesArray, minRating, maxRating, count = 1) {
    if (!playerHandlesArray || playerHandlesArray.length === 0) {
        throw new Error('playerHandlesArray cannot be empty');
    }

    const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('cf_handle, solved_problems')
        .in('cf_handle', playerHandlesArray);

    if (usersError) throw new Error(`Failed to fetch user data: ${usersError.message}`);

    const forbiddenSet = new Set();
    if (usersData) {
        for (const user of usersData) {
            if (user.solved_problems && Array.isArray(user.solved_problems)) {
                for (const problemId of user.solved_problems) {
                    forbiddenSet.add(problemId);
                }
            }
        }
    }

    let minR = Math.ceil(minRating / 100) * 100;
    let maxR = Math.floor(maxRating / 100) * 100;
    if (minR > maxR) {
        minR = minRating;
        maxR = maxRating;
    }

    const possibleRatings = [];
    for (let r = minR; r <= maxR; r += 100) {
        possibleRatings.push(r);
    }

    const selectedProblems = [];
    let attempts = 0;

    while (selectedProblems.length < count && attempts < count * 5) {
        attempts++;
        const targetRating = possibleRatings[Math.floor(Math.random() * possibleRatings.length)];
        
        const { data: problemsData, error: problemsError } = await supabase
            .from('problems')
            .select('*')
            .eq('rating', targetRating)
            .limit(1000);

        if (problemsError || !problemsData || problemsData.length === 0) continue;

        let available = problemsData.filter(p => !forbiddenSet.has(p.problem_id));
        available = available.filter(p => !selectedProblems.find(sp => sp.problem_id === p.problem_id));

        if (available.length > 0) {
            const chosen = available[Math.floor(Math.random() * available.length)];
            selectedProblems.push(chosen);
        }
    }

    if (selectedProblems.length < count) {
        throw new Error(`Exhausted Pool: Could not find enough unique problems in this rating range.`);
    }

    return selectedProblems;
}

module.exports = {
    getUniqueRoomProblems
};
