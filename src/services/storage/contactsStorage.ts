import { STORAGE_KEYS } from "config/constants";
import { dataStorage } from "services/storage/storageFactory";
import { Contact } from "types/contact";

export const contactsStorage = {
    getContacts: async (): Promise<Contact[]> => {
        const storedContacts = await dataStorage.getItem(STORAGE_KEYS.CONTACT_LIST);
        return storedContacts ? JSON.parse(storedContacts) : [];
    },

    saveContacts: async (contacts: Contact[]): Promise<void> => {
        await dataStorage.setItem(
            STORAGE_KEYS.CONTACT_LIST,
            JSON.stringify(contacts),
        );
    },

    addContact: async (contact: Contact): Promise<void> => {
        const contacts = await contactsStorage.getContacts();
        const newContacts = [...contacts, contact];
        await contactsStorage.saveContacts(newContacts);
    },

    updateContact: async (updatedContact: Contact): Promise<void> => {
        const contacts = await contactsStorage.getContacts();
        const newContacts = contacts.map((c) =>
            c.id === updatedContact.id ? updatedContact : c,
        );
        await contactsStorage.saveContacts(newContacts);
    },

    removeContact: async (contactId: string): Promise<void> => {
        const contacts = await contactsStorage.getContacts();
        const newContacts = contacts.filter((c) => c.id !== contactId);
        await contactsStorage.saveContacts(newContacts);
    },

    clearContacts: async (): Promise<void> => {
        await dataStorage.remove(STORAGE_KEYS.CONTACT_LIST);
    },
};
