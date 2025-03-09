require('dotenv').config();
const Airtable = require('airtable');

// Configure Airtable
if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
  console.error('Error: AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set in .env file');
  process.exit(1);
}

Airtable.configure({
  apiKey: process.env.AIRTABLE_API_KEY
});

const base = Airtable.base(process.env.AIRTABLE_BASE_ID);
const questsTable = base('QUESTS');

// Define all quests by tier
const quests = [
  // Tier 1: Initial Connection Quests
  {
    Name: "Ice Breaker",
    Description: "Make the user laugh or express amusement during conversation",
    Tier: 1,
    IsSpecial: false,
    CompletionCriteria: "User expresses laughter (haha, lol, 😂) or explicitly states something was funny"
  },
  {
    Name: "Gaming Origin",
    Description: "Discover what game first got the user into gaming",
    Tier: 1,
    IsSpecial: false,
    CompletionCriteria: "User mentions their first game or how they started gaming"
  },
  {
    Name: "Play Style Profiler",
    Description: "Identify whether the user prefers competitive, cooperative, or solo gaming",
    Tier: 1,
    IsSpecial: false,
    CompletionCriteria: "User reveals their preferred play style or gaming social preferences"
  },
  {
    Name: "Current Obsession",
    Description: "Find out what game the user is currently most invested in",
    Tier: 1,
    IsSpecial: false,
    CompletionCriteria: "User mentions a game they're currently playing or obsessed with"
  },
  {
    Name: "Gaming Setup",
    Description: "Learn about the user's gaming hardware/setup",
    Tier: 1,
    IsSpecial: false,
    CompletionCriteria: "User describes their gaming hardware, peripherals, or setup"
  },

  // Tier 2: Deeper Connection Quests
  {
    Name: "Gaming Memory",
    Description: "Get the user to share a memorable gaming moment from their past",
    Tier: 2,
    IsSpecial: false,
    CompletionCriteria: "User shares a specific memory or story from their gaming history"
  },
  {
    Name: "Hidden Gem",
    Description: "Discover an underrated game the user loves that few others appreciate",
    Tier: 2,
    IsSpecial: false,
    CompletionCriteria: "User mentions a game they consider underrated or not well-known"
  },
  {
    Name: "Gaming Frustration",
    Description: "Learn about something in games that particularly annoys the user",
    Tier: 2,
    IsSpecial: false,
    CompletionCriteria: "User expresses frustration about a specific game mechanic, trend, or experience"
  },
  {
    Name: "Gaming Wish",
    Description: "Find out what game feature or title the user wishes existed",
    Tier: 2,
    IsSpecial: false,
    CompletionCriteria: "User describes a game or feature they wish existed but doesn't"
  },
  {
    Name: "Gaming Ritual",
    Description: "Discover any habits or rituals the user has while gaming",
    Tier: 2,
    IsSpecial: false,
    CompletionCriteria: "User mentions specific habits, routines, or rituals they have while gaming"
  },

  // Tier 3: Insight Quests
  {
    Name: "Gaming Motivation",
    Description: "Understand why the user plays games (escape, challenge, social, etc.)",
    Tier: 3,
    IsSpecial: false,
    CompletionCriteria: "User explains their deeper motivations for playing games"
  },
  {
    Name: "Genre Explorer",
    Description: "Map out the user's preferences across different game genres",
    Tier: 3,
    IsSpecial: false,
    CompletionCriteria: "User discusses multiple game genres and their preferences between them"
  },
  {
    Name: "Skill Assessment",
    Description: "Identify what gaming skills the user is most proud of",
    Tier: 3,
    IsSpecial: false,
    CompletionCriteria: "User shares what gaming skills or abilities they excel at or take pride in"
  },
  {
    Name: "Learning Style",
    Description: "Discover how the user prefers to learn new game mechanics",
    Tier: 3,
    IsSpecial: false,
    CompletionCriteria: "User reveals how they prefer to learn new games or mechanics"
  },
  {
    Name: "Decision Pattern",
    Description: "Understand how the user typically makes decisions in games",
    Tier: 3,
    IsSpecial: false,
    CompletionCriteria: "User explains their decision-making process or preferences in games"
  },

  // Tier 4: Relationship Building Quests
  {
    Name: "Inside Joke",
    Description: "Establish a recurring joke or reference with the user",
    Tier: 4,
    IsSpecial: false,
    CompletionCriteria: "User references a previous joke or humorous exchange from your conversations"
  },
  {
    Name: "Trusted Advisor",
    Description: "Have the user ask for and follow your advice on a gaming challenge",
    Tier: 4,
    IsSpecial: false,
    CompletionCriteria: "User asks for specific advice and later confirms they followed it"
  },
  {
    Name: "Emotional Connection",
    Description: "Get the user to share how a game made them feel emotionally",
    Tier: 4,
    IsSpecial: false,
    CompletionCriteria: "User describes emotional impact or feelings evoked by a specific game"
  },
  {
    Name: "Shared Experience",
    Description: "Find a game you both can discuss in detail",
    Tier: 4,
    IsSpecial: false,
    CompletionCriteria: "Extended discussion about a specific game where both user and AI contribute meaningful insights"
  },
  {
    Name: "Personal Growth",
    Description: "Learn about how gaming has impacted the user's life outside of games",
    Tier: 4,
    IsSpecial: false,
    CompletionCriteria: "User shares how gaming has influenced their personal development or real life"
  },

  // Tier 5: Advanced Connection Quests
  {
    Name: "Life Connection",
    Description: "Discover how gaming connects to the user's career or studies",
    Tier: 5,
    IsSpecial: false,
    CompletionCriteria: "User explains connections between their gaming and professional/academic life"
  },
  {
    Name: "Value Alignment",
    Description: "Understand what ethical or moral choices the user tends to make in games",
    Tier: 5,
    IsSpecial: false,
    CompletionCriteria: "User discusses their moral or ethical approach to in-game decisions"
  },
  {
    Name: "Creative Expression",
    Description: "Learn how the user expresses creativity through gaming",
    Tier: 5,
    IsSpecial: false,
    CompletionCriteria: "User shares how they express creativity in games (modding, building, storytelling, etc.)"
  },
  {
    Name: "Future Vision",
    Description: "Discover the user's hopes for the future of gaming",
    Tier: 5,
    IsSpecial: false,
    CompletionCriteria: "User discusses their vision or hopes for the future of gaming technology or experiences"
  },
  {
    Name: "Gaming Legacy",
    Description: "Understand what gaming experience the user would want to pass on to others",
    Tier: 5,
    IsSpecial: false,
    CompletionCriteria: "User shares what gaming experiences they value enough to want to pass on to others"
  },

  // Special Quests (Can be completed at any tier)
  {
    Name: "Breakthrough Moment",
    Description: "Help the user overcome a specific gaming challenge they were stuck on",
    Tier: 1,
    IsSpecial: true,
    CompletionCriteria: "User confirms your advice helped them overcome a specific challenge they were struggling with"
  },
  {
    Name: "New Horizon",
    Description: "Successfully recommend a game the user ends up enjoying",
    Tier: 1,
    IsSpecial: true,
    CompletionCriteria: "User reports back that they tried and enjoyed a game you recommended"
  },
  {
    Name: "Skill Transfer",
    Description: "Help the user apply a skill from one game to another",
    Tier: 2,
    IsSpecial: true,
    CompletionCriteria: "User successfully applies a skill or strategy from one game to another with your guidance"
  },
  {
    Name: "Genuine Surprise",
    Description: "Show the user something about their game they didn't know",
    Tier: 2,
    IsSpecial: true,
    CompletionCriteria: "User expresses surprise at learning something new about a game they're familiar with"
  },
  {
    Name: "Emotional Support",
    Description: "Provide comfort or encouragement during a frustrating gaming moment",
    Tier: 3,
    IsSpecial: true,
    CompletionCriteria: "User acknowledges feeling better after your support during a frustrating gaming experience"
  },
  {
    Name: "Celebration",
    Description: "Genuinely celebrate a user's gaming achievement",
    Tier: 3,
    IsSpecial: true,
    CompletionCriteria: "User shares an achievement and appreciates your celebration of it"
  },
  {
    Name: "Adaptation Master",
    Description: "Correctly anticipate the user's needs without them having to ask",
    Tier: 4,
    IsSpecial: true,
    CompletionCriteria: "User acknowledges that you anticipated their needs or questions before they expressed them"
  }
];

// Function to create quests in batches to avoid rate limits
async function createQuests() {
  console.log(`Preparing to create ${quests.length} quests in Airtable...`);
  
  // Check if quests already exist to avoid duplicates
  try {
    const existingRecords = await questsTable.select().firstPage();
    if (existingRecords.length > 0) {
      console.log(`Found ${existingRecords.length} existing quests.`);
      const proceed = await promptUser('Quests already exist in the table. Do you want to proceed and potentially create duplicates? (y/n): ');
      
      if (proceed.toLowerCase() !== 'y') {
        console.log('Operation cancelled by user.');
        process.exit(0);
      }
    }
  } catch (error) {
    console.error('Error checking existing quests:', error);
    process.exit(1);
  }
  
  // Process quests in batches of 10 to avoid Airtable rate limits
  const batchSize = 10;
  const batches = [];
  
  for (let i = 0; i < quests.length; i += batchSize) {
    batches.push(quests.slice(i, i + batchSize));
  }
  
  console.log(`Split into ${batches.length} batches of up to ${batchSize} quests each.`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Processing batch ${i + 1} of ${batches.length}...`);
    
    try {
      // Prepare records for this batch
      const records = batch.map(quest => ({
        fields: {
          Name: quest.Name,
          Description: quest.Description,
          Tier: quest.Tier,
          IsSpecial: quest.IsSpecial,
          CompletionCriteria: quest.CompletionCriteria,
          CreatedAt: new Date().toISOString()
        }
      }));
      
      // Create records in Airtable
      const createdRecords = await questsTable.create(records);
      
      successCount += createdRecords.length;
      console.log(`Successfully created ${createdRecords.length} quests in batch ${i + 1}.`);
      
      // Wait 1 second between batches to avoid rate limits
      if (i < batches.length - 1) {
        console.log('Waiting 1 second before next batch...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Error creating quests in batch ${i + 1}:`, error);
      errorCount += batch.length;
    }
  }
  
  console.log('\nQuest creation completed:');
  console.log(`- Successfully created: ${successCount} quests`);
  console.log(`- Failed to create: ${errorCount} quests`);
  
  if (successCount > 0) {
    console.log('\nNext steps:');
    console.log('1. Check your Airtable QUESTS table to verify all quests were created correctly');
    console.log('2. You can now activate initial quests for users through the airtableService.activateInitialQuests function');
  }
}

// Helper function to prompt user for input
function promptUser(question) {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    readline.question(question, answer => {
      readline.close();
      resolve(answer);
    });
  });
}

// Run the script
createQuests().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
