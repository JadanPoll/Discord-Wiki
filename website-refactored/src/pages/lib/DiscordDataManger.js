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

import { get, set, clear, del } from 'idb-keyval'

export class DiscordDataManager {
    constructor() {
        // Init'ise data storage
        if (localStorage.getItem("activeServerDisc") === null)
            localStorage.setItem("activeServerDisc", "")

        if (localStorage.getItem("dbserverlist") === null)
            localStorage.setItem("dbserverlist", JSON.stringify([]))

        if (localStorage.getItem("channel_nicknames") === null)
            localStorage.setItem("channel_nicknames", JSON.stringify(Object.create(null)))

        this.dbname = 'dwikistore'
        this.glossarytablename = 'glossaries'
        this.messagestablename = 'messages'
        this.relationshipstablename = 'relationships'
    }

    async getDBServersObjList() {
        return JSON.parse(localStorage.getItem("dbserverlist"))
    }

    async setDBServersObjList(arr) {
        localStorage.setItem("dbserverlist", JSON.stringify(arr))
    }

    async getActiveServerDisc() {
        return localStorage.getItem("activeServerDisc")
    }

    getActiveServerDiscSync()
    {
        return localStorage.getItem("activeServerDisc")
    }

    async setActiveServerDisc(name) {
        localStorage.setItem("activeServerDisc", name)
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
    
    async getServerGameDisc(channel) {
        let entry = `gametitleimage_${channel}`
        return await get(entry)
    }
    async setServerGameDisc(channel, data) {
        let entry = `gametitleimage_${channel}`
        await set(entry,data)
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
    async setSummary(channel,topic,summary_data)
    {
        let entry = `summary_${channel}_${topic}`
        await set(entry,summary_data)
    }
    async getSummary(channel,topic)
    {
        let entry = `summary_${channel}_${topic}`
        return await get(entry)
    }
    
    async removeChannel(channel) {
        let dblist = await this.getDBServersObjList()

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
        this.setDBServersObjList(dblist)

        if (await this.getActiveServerDisc() === channel) {
            this.setActiveServerDisc(dblist[dblist.length - 1])
        }

        return { "status": true, "message": "OK." }
    }

    async purge() {
        // REMOVE ALL DATA
        localStorage.clear()
        await clear()
    }
}