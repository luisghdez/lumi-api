import OpenAI from "openai";

const openai = new OpenAI();

export const processGeneralMessage = async (message: string): Promise<string> => {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a helpful AI assistant. Provide clear, concise, and helpful responses to user questions."
      },
      {
        role: "user",
        content: message
      }
    ],
    temperature: 0.7,
  });

  return completion.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
};

export const processGeneralMessageWithHistory = async (
  message: string, 
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> => {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    {
      role: "system",
      content: "You are a helpful AI assistant. Provide clear, concise, and helpful responses to user questions. Maintain context from the conversation history."
    },
  ];

  // Add conversation history
  for (const msg of conversationHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // Add current message
  messages.push({ role: "user", content: message });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.7,
  });

  return completion.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
};
