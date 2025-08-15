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
