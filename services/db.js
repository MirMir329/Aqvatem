const { logError } = require("../logger/logger");
const path = require("path");
const { logAccess } = require("../logger/logger");
const sqlite3 = require("sqlite3").verbose();

const cities = [
  {
    key: "257",
    value: "Караганда",
  },
  {
    key: "259",
    value: "Темиртау",
  },
  {
    key: "889",
    value: "Материал от клиента",
  },
];
class Db {
  dbPath = path.resolve(__dirname, "../db/database.db");

  createTables() {
    const db = new sqlite3.Database(this.dbPath);
    db.serialize(() => {
      // Create users table
      db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY,  
                    name TEXT,
                    last_name TEXT,
                    department_ids TEXT,  -- Storing department IDs as a comma-separated string
                    password TEXT,
                    city TEXT
                );
            `);

      // Create deals table
      db.run(`
                CREATE TABLE IF NOT EXISTS deals (
                    id INTEGER PRIMARY KEY,  
                    title TEXT,
                    date_create DATE,
                    assigned_id INTEGER,
                    is_conducted BOOLEAN,
                    is_approved BOOLEAN,
                    is_moved BOOLEAN,
                    is_failed BOOLEAN,
                    is_amount_missmatch BOOLEAN,
                    service_price FLOAT,
                    city TEXT,
                    FOREIGN KEY (assigned_id) REFERENCES users(id)
                );
            `);

      // Create products table
      db.run(`
                CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY,  
                    name TEXT
                );
            `);

      // Create deals_products table
      db.run(`
                CREATE TABLE IF NOT EXISTS deals_products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- auto-increment
                    deal_id INTEGER,
                    product_id INTEGER,
                    given_amount REAL,  -- floating point numbers for quantities
                    fact_amount REAL,   -- floating point numbers for quantities
                    price FLOAT,
                    total REAL GENERATED ALWAYS AS (given_amount - fact_amount) STORED,  -- calculated field
                    FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
                    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                    UNIQUE (deal_id, product_id)
                );
            `);
    });

    db.close();
  }

  insertOneUserInDb(newUser = {}) {
    const db = new sqlite3.Database(this.dbPath);
    try {
      db.serialize(() => {
        const stmt = db.prepare(`
                INSERT INTO users ( name, last_name, department_ids, password, city)
                VALUES ( ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    last_name = excluded.last_name,
                    department_ids = excluded.department_ids,
                    password = excluded.password,
                    city = excluded.city
                WHERE users.id = excluded.id
            `);

        stmt.run(
          newUser.name,
          newUser.last_name,
          newUser.department_ids,
          newUser.password,
          newUser.city,
        );

        stmt.finalize();
      });
      return true;
    } catch (error) {
      logError("DB service insertUsersInDb", error);
      return false;
    } finally {
      db.close();
    }
  }

  insertUsersInDb(data = []) {
    const db = new sqlite3.Database(this.dbPath);
    try {
      db.serialize(() => {
        const stmt = db.prepare(`
                INSERT INTO users (id, name, last_name, department_ids, password)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    last_name = excluded.last_name,
                    department_ids = excluded.department_ids
                WHERE users.id = excluded.id
            `);

        data.forEach((user) => {
          // Join the department_ids array into a comma-separated string
          const departmentIdsString = (user.departments || []).join(",");

          // Insert or update user into the users table
          stmt.run(
            user.id,
            user.name,
            user.last_name,
            departmentIdsString,
            user.password
          );
        });

        stmt.finalize();
      });
      return true;
    } catch (error) {
      logError("DB service insertUsersInDb", error);
      return false;
    } finally {
      db.close();
    }
  }

  updateUserInDb(userId, data) {
    const db = new sqlite3.Database(this.dbPath);
    try {
      db.serialize(() => {
        // Construct the update query dynamically based on the provided data
        const updates = [];
        const params = [];

        // Add fields to update based on provided data
        if (data.name !== undefined) {
          updates.push("name = ?");
          params.push(data.name);
        }
        if (data.last_name !== undefined) {
          updates.push("last_name = ?");
          params.push(data.last_name);
        }
        if (data.departments !== undefined) {
          const departmentIdsString = (data.departments || []).join(",");
          updates.push("department_ids = ?");
          params.push(departmentIdsString);
        }
        if (data.password !== undefined) {
          updates.push("password = ?");
          params.push(data.password);
        }

        // Only proceed if there are updates to apply
        if (updates.length > 0) {
          const query = `UPDATE users SET ${updates.join(", ")} WHERE id = ?`;
          params.push(userId); // Add userId to params

          const stmt = db.prepare(query);
          stmt.run(...params); // Spread params into the run method
          stmt.finalize();
        }
      });
      return true; // Update was successful
    } catch (error) {
      logError("DB service updateUserInDb", error);
      return false; // Update failed
    } finally {
      db.close(); // Ensure the database is closed
    }
  }

  insertDealsInDb(data = []) {
    const db = new sqlite3.Database(this.dbPath);
    try {
      db.serialize(() => {
        const stmt = db.prepare(`
                    INSERT OR REPLACE INTO deals (id, title, date_create, assigned_id, city, service_price) VALUES (?, ?, ?, ?, ?, ?)
                `);

        data.forEach((deal) => {
          stmt.run(
            deal.id,
            deal.title,
            deal.date_create,
            deal.assigned_id,
            cities.find((city) => Number(city.key) === Number(deal.city))
              ?.value,
            deal.service_price
          );
        });

        stmt.finalize();
      });
      return true;
    } catch (error) {
      logError("DB service insertDealsInDb", error);
      return false;
    } finally {
      db.close();
    }
  }

  insertProductsInDb(data = []) {
    const db = new sqlite3.Database(this.dbPath);
    try {
      db.serialize(() => {
        const stmt = db.prepare(`
                INSERT OR REPLACE INTO products (id, name) VALUES (?, ?)
            `);

        data.forEach((product) => {
          stmt.run(product.id, product.name, (res, err) => {
            if (err) {
              logError("DB service insertProductsInDb run", err);
            }
          });
        });

        stmt.finalize();
      });
      return true;
    } catch (error) {
      logError("DB service insertProductsInDb", error);
      return false;
    } finally {
      db.close();
    }
  }

  insertDealsProductsInDb(data = []) {
    const db = new sqlite3.Database(this.dbPath);
    try {
      db.serialize(() => {
        const stmt = db.prepare(`
                    INSERT OR REPLACE INTO deals_products (deal_id, product_id, given_amount, fact_amount, price) 
                    VALUES (?, ?, ?, ?, ?)
                `);

        data.forEach((dealProduct) => {
          stmt.run(
            dealProduct.deal_id,
            dealProduct.product_id,
            dealProduct.given_amount,
            dealProduct.fact_amount,
            dealProduct.price
          );
        });

        stmt.finalize();
      });
      return true; // Return true to indicate success
    } catch (error) {
      logError("DB service insertDealsProductsInDb", error);
      return false; // Return false to indicate failure
    } finally {
      db.close(); // Ensure the database connection is closed
    }
  }

  deleteUserById(id) {
    const db = new sqlite3.Database(this.dbPath);
    try {
      db.serialize(() => {
        db.run(`DELETE FROM users WHERE id = ?`, [id], (err) => {
          if (err) {
            logError("DB service deleteUserById", err);
            return false;
          }
          logAccess("DB Service deleteUserById", `User with id ${id} deleted.`);
        });
      });
      return true;
    } finally {
      db.close();
    }
  }

  deleteDealById(id) {
    const db = new sqlite3.Database(this.dbPath);
    try {
      db.serialize(() => {
        db.run(`DELETE FROM deals WHERE id = ?`, [id], (err) => {
          if (err) {
            logError("DB service deleteDealById", err);
            return false;
          }
          logAccess("DB Service deleteDealById", `Deal with id ${id} deleted.`);
        });
      });
      return true;
    } finally {
      db.close();
    }
  }

  deleteProductById(id) {
    const db = new sqlite3.Database(this.dbPath);
    try {
      db.serialize(() => {
        db.run(`DELETE FROM products WHERE id = ?`, [id], (err) => {
          if (err) {
            logError("DB service deleteProductById", err);
            return false;
          }
          logAccess(
            "DB Service deleteProductById",
            `Product with id ${id} deleted.`
          );
        });
      });
      return true;
    } finally {
      db.close();
    }
  }

  clearDealsProductsTable() {
    const db = new sqlite3.Database(this.dbPath);
    try {
      db.serialize(() => {
        db.run(`DELETE FROM deals_products`, [], (err) => {
          if (err) {
            logError("DB service clearDealsProductsTable", err);
            return false;
          }
          logAccess(
            "DB Service clearDealsProductsTable",
            `deals_products table cleared successfully`
          );
        });
      });
    } finally {
      db.close();
    }
  }

  updateDealById(id, updatedFields = {}) {
    const db = new sqlite3.Database(this.dbPath);

    try {
      // Constructing dynamic SQL based on which fields are passed in updatedFields
      const fieldsToUpdate = [];
      const values = [];

      if (updatedFields.title) {
        fieldsToUpdate.push("title = ?");
        values.push(updatedFields.title);
      }
      if (updatedFields.date_create) {
        fieldsToUpdate.push("date_create = ?");
        values.push(updatedFields.date_create);
      }
      if (updatedFields.assigned_id) {
        fieldsToUpdate.push("assigned_id = ?");
        values.push(updatedFields.assigned_id);
      }
      if (updatedFields.is_conducted) {
        fieldsToUpdate.push("is_conducted = ?");
        values.push(updatedFields.is_conducted);
      }
      if (updatedFields.is_approved) {
        fieldsToUpdate.push("is_approved = ?");
        values.push(updatedFields.is_approved);
      }
      if (updatedFields.is_moved) {
        fieldsToUpdate.push("is_moved = ?");
        values.push(updatedFields.is_moved);
      }
      if (updatedFields.is_failed) {
        fieldsToUpdate.push("is_failed = ?");
        values.push(updatedFields.is_failed);
      }
      if (updatedFields.is_amount_missmatch) {
        fieldsToUpdate.push("is_amount_missmatch = ?");
        values.push(updatedFields.is_amount_missmatch);
      }
      if (updatedFields.service_price) {
        fieldsToUpdate.push("service_price = ?");
        values.push(updatedFields.service_price);
      }

      if (fieldsToUpdate.length === 0) {
        throw new Error("No fields to update");
      }

      // Add the id at the end of values array for the WHERE clause
      values.push(id);

      const sql = `
                UPDATE deals
                SET ${fieldsToUpdate.join(", ")}
                WHERE id = ?
            `;

      db.serialize(() => {
        db.run(sql, values, (err) => {
          if (err) {
            logError("DB service updateDealById", err);
            return false;
          }
          logAccess(
            "DB Service updateDealById",
            `Deal with id ${id} updated successfully.`
          );
        });
      });
      return true;
    } catch (error) {
      logError("DB service updateDealById", error);
      return false;
    } finally {
      db.close();
    }
  }

  getUserByFullName(fullName) {
    const db = new sqlite3.Database(this.dbPath);
    return new Promise((resolve, reject) => {
      try {
        // Split fullName into first name and last name
        const [name, lastName] = fullName.split(" ");
        db.get(
          `SELECT * FROM users WHERE LOWER(name) = LOWER(?) AND LOWER(last_name) = LOWER(?)`,
          [name, lastName],
          (err, row) => {
            if (err) {
              logError("DB service getUserByFullName", err);
              reject(err);
            } else {
              resolve(row || null); // Return the user row if found, otherwise null
            }
          }
        );
      } catch (error) {
        logError("DB service getUserByFullName", error);
        reject(error);
      } finally {
        db.close();
      }
    });
  }

  getDeals(assigned_id = null) {
    console.log(assigned_id, "id");

    const db = new sqlite3.Database(this.dbPath);
    return new Promise((resolve, reject) => {
      try {
        let statement = `SELECT * FROM deals`;
        const params = [];

        if (assigned_id !== null) {
          statement += " WHERE assigned_id = ?";
          params.push(assigned_id);
        }

        db.all(statement, params, (err, rows) => {
          if (err) {
            logError("DB service getDeals", err);
            reject(err);
          } else {
            resolve(rows); // Returns an array of all deals
          }
        });
      } catch (error) {
        logError("DB service getDeals", error);
        reject(error);
      } finally {
        db.close();
      }
    });
  }

  getProducts() {
    const db = new sqlite3.Database(this.dbPath);
    return new Promise((resolve, reject) => {
      try {
        db.all(`SELECT * FROM products`, (err, rows) => {
          if (err) {
            logError("DB service getProducts", err);
            reject(err);
          } else {
            resolve(rows); // Returns an array of all deals
          }
        });
      } catch (error) {
        logError("DB service getProducts", error);
        reject(error);
      } finally {
        db.close();
      }
    });
  }

  getAllUsers() {
    const db = new sqlite3.Database(this.dbPath);
    return new Promise((resolve, reject) => {
      try {
        db.all(`SELECT * FROM users`, (err, rows) => {
          if (err) {
            logError("DB service getAllUsers", err);
            reject(err);
          } else {
            resolve(rows || []); // Возвращаем все строки пользователей, если они есть, иначе пустой массив
          }
        });
      } catch (error) {
        logError("DB service getAllUsers", error);
        reject(error);
      } finally {
        db.close();
      }
    });
  }
  

  getDealsProducts(deal_id = null) {
    const db = new sqlite3.Database(this.dbPath);
    return new Promise((resolve, reject) => {
      try {
        let statement = `SELECT * FROM deals_products`;
        const params = [];

        if (deal_id !== null) {
          statement += " WHERE deal_id = ?";
          params.push(deal_id);
        }
        db.all(statement, params, (err, rows) => {
          if (err) {
            logError("DB service getDealsProducts", err);
            reject(err);
          } else {
            resolve(rows); // Returns an array of all deals
          }
        });
      } catch (error) {
        logError("DB service getDealsProducts", error);
        reject(error);
      } finally {
        db.close();
      }
    });
  }

  async updateDealProductQuantities({
    deal_id = null,
    product_id = null,
    fact_amount,
    given_amount,
  }) {
    const db = new sqlite3.Database(this.dbPath);

    try {
      // Ensure that either deal_id or product_id is provided
      if (!deal_id && !product_id) {
        throw new Error("Either deal_id or product_id must be provided.");
      }

      const conditions = [];
      const values = [fact_amount, given_amount]; // Fact amount will be updated

      // Add condition based on deal_id and product_id
      if (deal_id) {
        conditions.push("deal_id = ?");
        values.push(deal_id);
      }
      if (product_id) {
        conditions.push("product_id = ?");
        values.push(product_id);
      }

      console.log("values", values);
      // console.log("product_id", product_id);
      // console.log("deal_id", deal_id);
      
      const sql = `
        UPDATE deals_products
        SET fact_amount = ?, given_amount = ?
        WHERE ${conditions.join(" AND ")}
      `;

      // console.log(sql);
      
  //     db.serialize(() => {
  //       db.run(sql, values, (err) => {
  //         if (err) {
  //           logError("DB service updateDealProductQuantities", err);
  //           return false;
  //         }
  //         // SQLite will automatically update 'total' based on the new 'fact_amount'
  //         logAccess(
  //           "DB service updateDealProductQuantities",
  //           `Updated fact_amount in deals_products where ${
  //             deal_id ? `deal_id = ${deal_id}` : ""
  //           } ${product_id ? `and product_id = ${product_id}` : ""}`
  //         );
  //       });
  //     });
  //     return true;
  //   } catch (error) {
  //     logError("DB service updateDealProductQuantities", error);
  //     return false;
  //   } finally {
  //     db.close();
  //   }
  // }
    //  Используем Promise для обработки асинхронности
     await new Promise((resolve, reject) => {
      db.run(sql, values, function (err) {
          if (err) {
              logError("DB service updateDealProductQuantities", err);
              reject(err);
          } else {
              logAccess(
                  "DB service updateDealProductQuantities",
                  `Updated where ${deal_id ? `deal_id = ${deal_id}` : ""} ${product_id ? `product_id = ${product_id}` : ""}`
              );
              resolve();
            }
        });
    });

    return true;
  } catch (error) {
    logError("DB service updateDealProductQuantities", error);
    return false;
  } finally {
    db.close(); // Закрываем соединение только после завершения запроса
  }
  }

  getInstallationDepartmentMembers() {
    const db = new sqlite3.Database(this.dbPath);
    return new Promise((resolve, reject) => {
      try {
        db.all(
          `SELECT id, name, last_name, department_ids, city FROM users WHERE department_ids LIKE '%,27,%' 
                 OR department_ids LIKE '27,%' 
                 OR department_ids LIKE '%,27' 
                 OR department_ids = '27'`,
          (err, rows) => {
            if (err) {
              logError("DB service getInstallationDepartmentMembers", err);
              reject(err);
            } else {
              resolve(rows); // Returns an array of users with department 45
            }
          }
        );
      } catch (error) {
        logError("DB service getInstallationDepartmentMembers", error);
        reject(error);
      } finally {
        db.close();
      }
    });
  }

  updateDealsProducts(dealId, products = []) {
    const db = new sqlite3.Database(this.dbPath);

    try {
      db.serialize(() => {
        // Step 1: Remove existing entries that are no longer in the updated list
        const productIds = products.map((product) => product.id).join(",");
        db.run(
          `
                DELETE FROM deals_products
                WHERE deal_id = ? AND product_id NOT IN (${productIds})
            `,
          dealId
        );

        // Step 2: Insert or update products from the new list
        const stmt = db.prepare(`
                INSERT INTO deals_products (deal_id, product_id, given_amount, fact_amount)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(deal_id, product_id) 
                DO UPDATE SET 
                    given_amount = excluded.given_amount,
                    fact_amount = excluded.fact_amount
            `);

        products.forEach((product) => {
          const productId = Number(product.id); // Ensure product.id is treated as a number
          const givenAmount = Number(product.given_amount);
          const factAmount =
            product.fact_amount !== null ? Number(product.fact_amount) : null; // Handle nulls properly

          stmt.run(dealId, productId, givenAmount, factAmount);
        });

        stmt.finalize();
      });

      return true; // Indicate success
    } catch (error) {
      logError("DB service updateDealsProducts", error);
      return false;
    } finally {
      db.close();
    }
  }

  deleteDealsProductsRowByDealId(dealId) {
    const db = new sqlite3.Database(this.dbPath);
    try {
      db.serialize(() => {
        db.run(
          `DELETE FROM deals_products WHERE deal_id = ?`,
          [dealId],
          (err) => {
            if (err) {
              logError("DB service deleteDealsProductsRowByDealId", err);
              return false;
            }
            logAccess(
              "DB Service deleteDealsProductsRowByDealId",
              `deals_products with id ${dealId} deleted.`
            );
          }
        );
      });
      return true;
    } finally {
      db.close();
    }
  }

  clearDealsTable() {
    const db = new sqlite3.Database(this.dbPath);
    try {
      db.serialize(() => {
        db.run(`DELETE FROM deals`, [], (err) => {
          if (err) {
            logError("DB service clearDealsTable", err);
            return false;
          }
          logAccess(
            "DB Service clearDealsTable",
            `deals table cleared successfully`
          );
        });
      });
    } finally {
      db.close();
    }
  }

  clearProductsTable() {
    const db = new sqlite3.Database(this.dbPath);
    try {
      db.serialize(() => {
        db.run(`DELETE FROM products`, [], (err) => {
          if (err) {
            logError("DB service clearProductsTable", err);
            return false;
          }
          logAccess(
            "DB Service clearProductsTable",
            `products table cleared successfully`
          );
        });
      });
    } finally {
      db.close();
    }
  }

  getDealMaxId() {
    const db = new sqlite3.Database(this.dbPath);
    return new Promise(async (resolve, reject) => {
      try {
        db.get(`SELECT MAX(id) AS max_id FROM deals`, (err, row) => {
          if (err) {
            logError("DB service getDealMaxId", err);
            reject(err);
          } else {
            resolve(row || null);
          }
        });
      } catch (error) {
        logError("DB service getDeals", error);
        return null;
      } finally {
        db.close();
      }
    });
  }
}

module.exports = Db;
