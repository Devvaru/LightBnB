const { query } = require("express");
const properties = require("./json/properties.json");
const users = require("./json/users.json");
const { Pool } = require('pg');

const pool = new Pool({
  user: 'labber',
  password: 'labber',
  host: 'localhost',
  database: 'lightbnb'
});

/// Users

/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithEmail = function(email) {
  return pool
    .query(`SELECT * FROM users WHERE email = $1`, [email])
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.log(err.message);
      return null;
    });
};

/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = function(id) {
  return pool
    .query(`SELECT * FROM users WHERE id = $1`, [id])
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.log(err.message);
      return null;
    });
};

/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser = function(user) {
  return pool
    .query(`INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *`, [user.name, user.email, user.password])
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.log(err.message);
      return null;
    });
};

/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
const getAllReservations = function(guestId, limit = 10) {
  return pool
    .query(`
    SELECT reservations.id, properties.title, properties.thumbnail_photo_url, properties.cover_photo_url, properties.number_of_bedrooms, properties.number_of_bathrooms, properties.parking_spaces, properties.cost_per_night, reservations.start_date, AVG(property_reviews.rating)
    FROM reservations
    JOIN properties ON reservations.property_id = properties.id
    JOIN property_reviews ON properties.id = property_reviews.property_id
    WHERE reservations.guest_id = $1
    GROUP BY properties.id, reservations.id
    ORDER BY reservations.start_date
    LIMIT $2`, [guestId, limit])
    .then((result) => {
      return result.rows;
    })
    .catch((err) => {
      console.log(err.message);
    });
};

/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */
const getAllProperties = function(options, limit = 10) {
  // Setup an array to hold any parameters that may be available for the query
  const queryParams = [];

  // Start the query with all information that comes before the WHERE clause
  let queryString = `
    SELECT properties.*, AVG(property_reviews.rating) AS average_rating
    FROM properties
    JOIN property_reviews ON properties.id = property_id
  `;

  const conditions = [];

  // Check if a city has been passed in as an option. Add the city to the params array and create a WHERE clause for the city
  // We can use the length of the array to dynamically get the $n placeholder number
  if (options.city) {
    queryParams.push(`%${options.city}%`);
    conditions.push(`LOWER(city) LIKE LOWER($${queryParams.length})`);
  }

  if (options.owner_id) {
    queryParams.push(`${options.owner_id}`);
    conditions.push(`owner_id = $${queryParams.length}`);
  }

  if (options.minimum_price_per_night) {
    const costPerNightCents = options.minimum_price_per_night * 100;
    queryParams.push(`${costPerNightCents}`);
    conditions.push(`cost_per_night >= $${queryParams.length}`);
  }

  if (options.maximum_price_per_night) {
    const costPerNightCents = options.maximum_price_per_night * 100;
    queryParams.push(`${costPerNightCents}`);
    conditions.push(`cost_per_night <= $${queryParams.length}`);
  }

  // Add WHERE clause joined by AND between each
  if (conditions.length > 0) {
    queryString += `WHERE ${conditions.join(' AND ')}`;
  }

  // Add any query that comes after the WHERE clause
  queryString += ` GROUP BY properties.id`;

  if (options.minimum_rating) {
    queryParams.push(options.minimum_rating);
    queryString += ` HAVING AVG(rating) >= $${queryParams.length}`;
  }

  queryParams.push(limit);
  queryString += ` ORDER BY cost_per_night LIMIT $${queryParams.length};`;

  // Console log everything just to make sure we've done it right
  console.log(queryString, queryParams);

  // Run the query
  return pool.query(queryString, queryParams).then((res) => res.rows);
};

/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = function(property) {
  // Convert cost_per_night to cents before inserting into table
  const costPerNightCents = property.cost_per_night * 100;

  return pool
    .query(`
    INSERT INTO properties
    (owner_id, title, description, thumbnail_photo_url, cover_photo_url, cost_per_night, street, city, province, post_code, country, parking_spaces, number_of_bathrooms, number_of_bedrooms) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
    [
      property.owner_id,
      property.title,
      property.description,
      property.thumbnail_photo_url,
      property.cover_photo_url,
      costPerNightCents,
      property.street,
      property.city,
      property.province,
      property.post_code,
      property.country,
      property.parking_spaces,
      property.number_of_bathrooms,
      property.number_of_bedrooms
    ])
    .then((result) => {
      return result;
    })
    .catch((err) => {
      console.log(err.message);
      return null;
    });
};

module.exports = {
  getUserWithEmail,
  getUserWithId,
  addUser,
  getAllReservations,
  getAllProperties,
  addProperty,
};
