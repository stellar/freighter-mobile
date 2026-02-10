import { STORAGE_KEYS } from "config/constants";
import { contactsStorage } from "services/storage/contactsStorage";
import { dataStorage } from "services/storage/storageFactory";
import { Contact } from "types/contact";

// Mock the dataStorage dependency
jest.mock("services/storage/storageFactory", () => ({
    dataStorage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        remove: jest.fn(),
    },
}));

describe("contactsStorage", () => {
    const mockContact: Contact = {
        id: "1",
        address: "GABC...",
        name: "Test Contact",
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("getContacts", () => {
        it("should return an empty array if no contacts are stored", async () => {
            (dataStorage.getItem as jest.Mock).mockResolvedValue(null);
            const contacts = await contactsStorage.getContacts();
            expect(contacts).toEqual([]);
            expect(dataStorage.getItem).toHaveBeenCalledWith(
                STORAGE_KEYS.CONTACT_LIST,
            );
        });

        it("should return stored contacts", async () => {
            (dataStorage.getItem as jest.Mock).mockResolvedValue(
                JSON.stringify([mockContact]),
            );
            const contacts = await contactsStorage.getContacts();
            expect(contacts).toEqual([mockContact]);
            expect(dataStorage.getItem).toHaveBeenCalledWith(
                STORAGE_KEYS.CONTACT_LIST,
            );
        });
    });

    describe("saveContacts", () => {
        it("should save contacts to storage", async () => {
            await contactsStorage.saveContacts([mockContact]);
            expect(dataStorage.setItem).toHaveBeenCalledWith(
                STORAGE_KEYS.CONTACT_LIST,
                JSON.stringify([mockContact]),
            );
        });
    });

    describe("addContact", () => {
        it("should add a new contact to the list", async () => {
            // Mock existing contacts
            (dataStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([]));

            await contactsStorage.addContact(mockContact);

            expect(dataStorage.setItem).toHaveBeenCalledWith(
                STORAGE_KEYS.CONTACT_LIST,
                JSON.stringify([mockContact]),
            );
        });

        it("should append to existing contacts", async () => {
            const existingContact = { ...mockContact, id: "2" };
            (dataStorage.getItem as jest.Mock).mockResolvedValue(
                JSON.stringify([existingContact]),
            );

            await contactsStorage.addContact(mockContact);

            expect(dataStorage.setItem).toHaveBeenCalledWith(
                STORAGE_KEYS.CONTACT_LIST,
                JSON.stringify([existingContact, mockContact]),
            );
        });
    });

    describe("updateContact", () => {
        it("should update an existing contact", async () => {
            (dataStorage.getItem as jest.Mock).mockResolvedValue(
                JSON.stringify([mockContact]),
            );
            const updatedContact = { ...mockContact, name: "Updated Name" };

            await contactsStorage.updateContact(updatedContact);

            expect(dataStorage.setItem).toHaveBeenCalledWith(
                STORAGE_KEYS.CONTACT_LIST,
                JSON.stringify([updatedContact]),
            );
        });

        it("should not affect other contacts", async () => {
            const otherContact = { ...mockContact, id: "2" };
            (dataStorage.getItem as jest.Mock).mockResolvedValue(
                JSON.stringify([mockContact, otherContact]),
            );
            const updatedContact = { ...mockContact, name: "Updated Name" };

            await contactsStorage.updateContact(updatedContact);

            expect(dataStorage.setItem).toHaveBeenCalledWith(
                STORAGE_KEYS.CONTACT_LIST,
                JSON.stringify([updatedContact, otherContact]),
            );
        });
    });

    describe("removeContact", () => {
        it("should remove a contact by id", async () => {
            (dataStorage.getItem as jest.Mock).mockResolvedValue(
                JSON.stringify([mockContact]),
            );

            await contactsStorage.removeContact(mockContact.id);

            expect(dataStorage.setItem).toHaveBeenCalledWith(
                STORAGE_KEYS.CONTACT_LIST,
                JSON.stringify([]),
            );
        });

        it("should not affect other contacts", async () => {
            const otherContact = { ...mockContact, id: "2" };
            (dataStorage.getItem as jest.Mock).mockResolvedValue(
                JSON.stringify([mockContact, otherContact]),
            );

            await contactsStorage.removeContact(mockContact.id);

            expect(dataStorage.setItem).toHaveBeenCalledWith(
                STORAGE_KEYS.CONTACT_LIST,
                JSON.stringify([otherContact]),
            );
        });
    });

    describe("clearContacts", () => {
        it("should remove the contact list from storage", async () => {
            await contactsStorage.clearContacts();
            expect(dataStorage.remove).toHaveBeenCalledWith(
                STORAGE_KEYS.CONTACT_LIST,
            );
        });
    });
});
