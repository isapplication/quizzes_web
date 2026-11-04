/**
 * "Suggest a name" for guests: an adjective and an animal, both kind and school-safe, like "Brave Panda". At most 20
 * characters, as the server allows; the server still checks every nickname.
 */
export const ADJECTIVES = [
  "Brave", "Bright", "Calm", "Clever", "Cool", "Curious", "Daring", "Eager", "Fast", "Friendly", "Funny", "Gentle",
  "Happy", "Helpful", "Jolly", "Kind", "Lively", "Lucky", "Mighty", "Neat", "Nimble", "Noble", "Proud", "Quick",
  "Quiet", "Rapid", "Smart", "Sharp", "Shiny", "Snappy", "Speedy", "Steady", "Sunny", "Super", "Swift", "Tidy",
  "Witty", "Wise", "Zesty", "Bold", "Busy", "Chirpy", "Cosy", "Dizzy", "Fancy", "Fluffy", "Golden", "Grand",
  "Humble", "Jumpy", "Merry", "Peppy", "Plucky", "Royal", "Silver", "Sparkly", "Spotty", "Starry", "Bouncy", "Cheery",
];

export const ANIMALS = [
  "Panda", "Tiger", "Falcon", "Dolphin", "Koala", "Otter", "Penguin", "Fox", "Owl", "Rabbit", "Turtle", "Zebra",
  "Lion", "Eagle", "Gazelle", "Camel", "Oryx", "Lynx", "Hawk", "Heron", "Parrot", "Puffin", "Seal", "Whale",
  "Shark", "Squid", "Gecko", "Iguana", "Llama", "Moose", "Bison", "Badger", "Beaver", "Bee", "Butterfly", "Cheetah",
  "Crab", "Deer", "Duck", "Ferret", "Flamingo", "Frog", "Giraffe", "Goat", "Hedgehog", "Hippo", "Horse", "Jaguar",
  "Kangaroo", "Kiwi", "Lemur", "Leopard", "Meerkat", "Monkey", "Ostrich", "Peacock", "Pelican", "Robin", "Sloth", "Swan",
];

const MAX = 20;

/** A name like "Brave Panda" that fits in 20 characters; {@code random} returns 0 ≤ x < 1. */
export function suggestNickname(random: () => number = Math.random): string {
  for (let i = 0; i < 20; i++) {
    const name = ADJECTIVES[Math.floor(random() * ADJECTIVES.length)] + " " + ANIMALS[Math.floor(random() * ANIMALS.length)];
    if (name.length <= MAX) return name;
  }
  return "Happy Panda";
}
