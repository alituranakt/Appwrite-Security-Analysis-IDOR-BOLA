window.Appwrite = (function() {
  class Client {
    setEndpoint() { return this; }
    setProject() { return this; }
  }

  let db = [];
  let currentUser = null;

  class Account {
    async create(args) {
      if(args.email === 'error@example.com') throw new Error("Mock error");
      return { $id: args.userId, email: args.email, name: args.name };
    }
    async createEmailPasswordSession(args) {
      currentUser = { $id: `user_${Date.now()}`, email: args.email, name: args.email.split('@')[0] };
      return {};
    }
    async get() {
      if(!currentUser) throw new Error("No session");
      return currentUser;
    }
    async deleteSession() {
      currentUser = null;
    }
  }

  class Storage {
    async createFile(args) {
      return { $id: `file_${Math.random().toString(36).substr(2,9)}` };
    }
    getFileView(args) {
        return "data:text/plain;charset=utf-8,Mocked%20Invoice%20Content%20for%20" + args.fileId;
    }
  }

  class TablesDB {
    async createRow(args) {
      const row = {
        $id: args.rowId,
        $createdAt: new Date().toISOString(),
        ...args.data
      };
      db.push(row);
      return row;
    }
    async listRows(args) {
      return { rows: db.filter(r => args.queries[0].value.includes(r.ownerUserId)) };
    }
  }

  class Functions {
    async createExecution(args) {
      const { invoiceId } = JSON.parse(args.body);
      const row = db.find(r => r.$id === invoiceId);
      if(!row) return { $id: "exec_1", responseStatusCode: 404, responseBody: JSON.stringify({ error: "Not found" }) };
      
      if(args.functionId.includes("secure") && row.ownerUserId !== currentUser?.$id) {
        return { $id: "exec_2", responseStatusCode: 403, responseBody: JSON.stringify({ error: "Permission Denied" }) };
      }
      
      return {
        $id: "exec_3",
        responseStatusCode: 200,
        responseBody: JSON.stringify({
          message: "Success",
          invoice: row
        })
      };
    }
  }

  const ID = { unique: () => `id_${Math.random().toString(36).substr(2,9)}` };
  const Permission = { read: ()=>"", update: ()=>"", delete: ()=>"" };
  const Role = { user: (id)=>id };
  const Query = { equal: (key, val) => ({key, value: val}) };

  return { Client, Account, Storage, TablesDB, Functions, ID, Permission, Role, Query };
})();
