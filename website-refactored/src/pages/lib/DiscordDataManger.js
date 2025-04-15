/**
 * Manages Discord Data using localStorage/IndexedDB.
 * This class is a refactored replacement of what used to be session in the old website.
 * 
 * Note that this is framed as a class but in no way encapsulates the data.
 * Instead, no matter how many instances of this class is made,
 * it will refer to the same set of localStorage in the user's computer.
 * 
 * This class provides a constructor, which initialises the data storage on localStorage.
 * It does nothing if there is an existing storage.
 * This class also provides a number of auxillary functions.
 * 
 * Keys used (note that datatypes shown are original data types, all data are converted by JSON.stringify):
 * activeServerDisc = [String] => localStorage.
 * dblist = [Array] => localStorage.
 * channelNickname = [Array] => localStorage.
 * glossary_<id> = [Object] => IndexedDB.
 * messages_<id> = [Object] => IndexedDB.
 * relationships_<id> = [Object] => IndexedDB.
 * 
 * 
 * NB: globalglossary is removed for performance reasons.
 */
import { get, set, clear, del, keys } from "idb-keyval";
export class DiscordDataManager {
  // Holds the single instance.
  static instance = null;

  constructor() {
    if (DiscordDataManager.instance) {
      return DiscordDataManager.instance;
    }
    // Initialize localStorage if not already set.
    if (!localStorage.getItem("activeServerDisc"))
      localStorage.setItem("activeServerDisc", "");

    if (!localStorage.getItem("dbserverlist"))
      localStorage.setItem("dbserverlist", JSON.stringify([]));

    if (!localStorage.getItem("channel_nicknames"))
      localStorage.setItem("channel_nicknames", JSON.stringify({}));

    // These properties can be used to namespace your IndexedDB keys:
    this.dbname = "dwikistore";
    this.glossarytablename = "glossaries";
    this.messagestablename = "messages";
    this.relationshipstablename = "relationships";

    DiscordDataManager.instance = this;
  }

  // Returns the singleton instance.
  static getInstance() {
    if (!DiscordDataManager.instance) {
      DiscordDataManager.instance = new DiscordDataManager();
    }
    return DiscordDataManager.instance;
  }

  // ----- LocalStorage Methods -----
  async getDBServersObjList() {
    try {
      return JSON.parse(localStorage.getItem("dbserverlist"));
    } catch (error) {
      console.error("Error reading dbserverlist:", error);
      return [];
    }
  }

  async setDBServersObjList(arr) {
    localStorage.setItem("dbserverlist", JSON.stringify(arr));
  }

  async getActiveServerDisc() {
    return localStorage.getItem("activeServerDisc") || "";
  }

  getActiveServerDiscSync() {
    return localStorage.getItem("activeServerDisc") || "";
  }

  async setActiveServerDisc(name) {
    localStorage.setItem("activeServerDisc", name);
  }

  async getChannelNickname(channel) {
    try {
      const nicknameStore = JSON.parse(localStorage.getItem("channel_nicknames")) || {};
      return nicknameStore[channel] || "";
    } catch (error) {
      console.error("Error reading channel nicknames:", error);
      return "";
    }
  }

  getChannelNicknameSync(channel) {
    try {
      const nicknameStore = JSON.parse(localStorage.getItem("channel_nicknames")) || {};
      return nicknameStore[channel] || "";
    } catch (error) {
      console.error("Error reading channel nicknames:", error);
      return "";
    }
  }

  async setChannelNickname(channel, nickname) {
    try {
      const nicknameStore = JSON.parse(localStorage.getItem("channel_nicknames")) || {};
      nicknameStore[channel] = nickname;
      localStorage.setItem("channel_nicknames", JSON.stringify(nicknameStore));
    } catch (error) {
      console.error("Error setting channel nickname:", error);
    }
  }

  // ----- IndexedDB Methods via idb-keyval -----
  async getGlossary(channel) {
    try {
      const entry = `glossary/${channel}`;
      return await get(entry);
    } catch (error) {
      console.error("Error getting glossary:", error);
      return null;
    }
  }

  async setGlossary(channel, data) {
    const entry = `glossary/${channel}`;
    return await set(entry, data);
  }

  async getMessages(channel) {
    try {
      const entry = `messages/${channel}`;
      return await get(entry);
    } catch (error) {
      console.error("Error getting messages:", error);
      return null;
    }
  }

  async setMessages(channel, data) {
    const entry = `messages/${channel}`;
    return await set(entry, data);
  }

  async getServerGameDisc(channel) {
    try {
      const entry = `gametitleimage/${channel}`;
      return await get(entry);
    } catch (error) {
      console.error("Error getting server game disc:", error);
      return null;
    }
  }

  async setServerGameDisc(channel, data) {
    const entry = `gametitleimage/${channel}`;
    return await set(entry, data);
  }

  async getRelationships(channel) {
    try {
      const entry = `relationships/${channel}`;
      return await get(entry);
    } catch (error) {
      console.error("Error getting relationships:", error);
      return null;
    }
  }

  async setRelationships(channel, data) {
    const entry = `relationships/${channel}`;
    return await set(entry, data);
  }

  async getConversationBlocks(channel) {
    try {
      const entry = `convblocks/${channel}`;
      return await get(entry);
    } catch (error) {
      console.error("Error getting conversation blocks:", error);
      return null;
    }
  }

  async setConversationBlocks(channel, data) {
    const entry = `convblocks/${channel}`;
    return await set(entry, data);
  }

  async setSummary(channel, topic, summaryData) {
    const entry = `summary/${channel}/${topic}`;
    return await set(entry, summaryData);
  }

  async setAllSummariesForChannel(channel, summaries) {
    try {
      const summaryEntries = Object.entries(summaries);
      for (const [topic, summaryData] of summaryEntries) {
        const key = `summary/${channel}/${topic}`;
        await set(key, summaryData);
      }
    } catch (error) {
      console.error("Error setting all summaries for channel:", error);
    }
  }
  async getSummary(channel, topic) {
    const entry = `summary/${channel}/${topic}`;
    return await get(entry);
  }


  async getAllSummariesForChannel(channel) {
    try {
      // Retrieve all keys from IndexedDB using idb-keyval
      const allKeys = await keys();
      // Filter to get only keys for summaries for this channel:
      const summaryPrefix = `summary/${channel}/`;
      const summaryKeys = allKeys.filter(
        (key) => typeof key === "string" && key.startsWith(summaryPrefix)
      );
  
      // Retrieve summary data for each key
      const summaries = {};
      for (const key of summaryKeys) {
        // Key structure: "summary/<channel>/<topic>"
        const parts = key.split("/");
        const topic = parts[2];
        summaries[topic] = await get(key);
      }
      return summaries;
    } catch (error) {
      console.error("Error retrieving summaries for channel:", error);
      return {};
    }
  }
  async removeChannel(channel) {
    try {
      const dblist = await this.getDBServersObjList();
      if (!dblist.includes(channel)) {
        return { status: false, message: "No such file found." };
      }

      if (dblist.length === 1) {
        // Special: if it's the only file, purging is simpler
        await this.purge();
        return { status: true, message: "OK." };
      }

      // Delete specific keys using the folder-separation style.
      await del(`messages/${channel}`);

      const nicknameStore = JSON.parse(localStorage.getItem("channel_nicknames")) || {};
      delete nicknameStore[channel];
      localStorage.setItem("channel_nicknames", JSON.stringify(nicknameStore));

      await del(`glossary/${channel}`);
      await del(`relationships/${channel}`);
      await del(`convblocks/${channel}`);

      // Remove channel from list and update active channel if needed.
      const updatedList = dblist.filter((ch) => ch !== channel);
      await this.setDBServersObjList(updatedList);

      if ((await this.getActiveServerDisc()) === channel) {
        await this.setActiveServerDisc(updatedList[updatedList.length - 1]);
      }

      return { status: true, message: "OK." };
    } catch (error) {
      console.error("Error removing channel:", error);
      return { status: false, message: "Error encountered." };
    }
  }

  async purge() {
    try {
      // Remove all localStorage and IndexedDB managed keys.
      localStorage.clear();
      await clear();
    } catch (error) {
      console.error("Error purging data:", error);
    }
  }
}

