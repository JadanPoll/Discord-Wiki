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
 * activedb = [String] => localStorage.
 * dblist = [Array] => localStorage.
 * channelNickname = [Array] => localStorage.
 * glossary_<id> = [Object] => IndexedDB.
 * messages_<id> = [Object] => IndexedDB.
 * relationships_<id> = [Object] => IndexedDB.
 * 
 * 
 * NB: globalglossary is removed for performance reasons.
 */

import { get, set, clear, del } from 'idb-keyval'

export class DiscordDataManager {
    constructor() {
        // Init'ise data storage
        if (localStorage.getItem("activedb") === null)
            localStorage.setItem("activedb", "")

        if (localStorage.getItem("dblist") === null)
            localStorage.setItem("dblist", JSON.stringify([]))

        if (localStorage.getItem("channel_nicknames") === null)
            localStorage.setItem("channel_nicknames", JSON.stringify(Object.create(null)))

        this.dbname = 'dwikistore'
        this.glossarytablename = 'glossaries'
        this.messagestablename = 'messages'
        this.relationshipstablename = 'relationships'
    }

    async getDBList() {
        return JSON.parse(localStorage.getItem("dblist"))
    }

    async setDBList(arr) {
        localStorage.setItem("dblist", JSON.stringify(arr))
    }

    async getActiveDB() {
        return localStorage.getItem("activedb")
    }

    getActiveDBSync()
    {
        return localStorage.getItem("activedb")
    }

    async setActiveDB(name) {
        localStorage.setItem("activedb", name)
    }

    async getChannelNickname(channel) {
        let nicknameStore = JSON.parse(localStorage.getItem("channel_nicknames"))
        return nicknameStore[channel]
    }

    getChannelNicknameSync(channel) {
        let nicknameStore = JSON.parse(localStorage.getItem("channel_nicknames"))
        if (channel in nicknameStore) return nicknameStore[channel]
        return ""
    }

    async setChannelNickname(channel, nickname) {
        // channel <channel> is known as <nickname>.
        let nicknameStore = JSON.parse(localStorage.getItem("channel_nicknames"))
        nicknameStore[channel] = nickname

        localStorage.setItem("channel_nicknames", JSON.stringify(nicknameStore))
    }

    async getGlossary(channel) {
        let entry = `glossary_${channel}`
        return await get(entry)
    }

    async setGlossary(channel, data) {
        let entry = `glossary_${channel}`
        await set(entry, data)
    }

    async getMessages(channel) {
        let entry = `messages_${channel}`
        return await get(entry)
    }

    async setMessages(channel, data) {
        let entry = `messages_${channel}`
        await set(entry, data)
    }

    async getRelationships(channel) {
        let entry = `relationships_${channel}`
        return await get(entry)
    }

    async setRelationships(channel, data) {
        let entry = `relationships_${channel}`
        await set(entry, data)
    }

    async getConversationBlocks(channel) {
        let entry = `convblocks_${channel}`
        return await get(entry)
    }

    async setConversationBlocks(channel, data) {
        let entry = `convblocks_${channel}`
        await set(entry, data)
    }

    async removeChannel(channel) {
        let dblist = await this.getDBList()

        if (!dblist.includes(channel)) {
            return { "status": false, "message": "No such file found." }
        }

        if (dblist.length === 1) {
            // special case: this is the only file. This is effectly purging.
            this.purge()
            return { "status": true, "message": "OK." }
        }

        await del(`messages_${channel}`)

        let nicknameStore = JSON.parse(localStorage.getItem("channel_nicknames"))
        delete nicknameStore[channel]
        localStorage.setItem("channel_nicknames", JSON.stringify(nicknameStore))

        await del(`glossary_${channel}`)
        await del(`relationships_${channel}`)
        await del(`convblocks_${channel}`)

        dblist.splice(dblist.indexOf(channel), 1)
        this.setDBList(dblist)

        if (await this.getActiveDB() === channel) {
            this.setActiveDB(dblist[dblist.length - 1])
        }

        return { "status": true, "message": "OK." }
    }

    async purge() {
        // REMOVE ALL DATA
        localStorage.clear()
        await clear()
    }
}