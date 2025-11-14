// routes/publicApis.js
// Backend proxy for public APIs to avoid CORS issues

import express from 'express';
import https from 'https';
const router = express.Router();

/**
 * Get Israeli cities from data.gov.il
 * Proxy endpoint to avoid CORS issues in frontend
 */
router.get('/israeli-cities', async (req, res) => {
  try {

    const options = {
      hostname: 'data.gov.il',
      path: '/api/action/datastore_search?resource_id=b7cf8f14-64a2-4b33-8d4b-edb286fdbd37&limit=1500',
      method: 'GET',
      headers: {
        'User-Agent': 'Ludora-API/1.0'
      }
    };

    const data = await new Promise((resolve, reject) => {
      const req = https.request(options, (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (error) {
            reject(new Error('Invalid JSON response'));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });

    if (!data.success || !data.result || !data.result.records) {
      throw new Error('Invalid response format from data.gov.il');
    }

    // Extract city names and remove duplicates
    const cities = data.result.records
      .map(record => record.שם_ישוב || record.city_name || record.name)
      .filter(city => city && typeof city === 'string')
      .map(city => city.trim())
      .filter(city => city.length > 0)
      // Remove duplicates and sort alphabetically
      .reduce((unique, city) => {
        if (!unique.includes(city)) {
          unique.push(city);
        }
        return unique;
      }, [])
      .sort((a, b) => a.localeCompare(b, 'he'));


    res.json({
      success: true,
      cities: cities,
      count: cities.length,
      source: 'data.gov.il',
      cached: false
    });

  } catch (error) {

    // Return fallback list of major Israeli cities
    const fallbackCities = [
      'ירושלים', 'תל אביב-יפו', 'חיפה', 'ראשון לציון', 'אשדוד', 'פתח תקווה',
      'באר שבע', 'נתניה', 'חולון', 'בני ברק', 'רמת גן', 'אשקלון',
      'רחובות', 'בת ים', 'הרצליה', 'כפר סבא', 'מודיעין-מכבים-רעות',
      'נצרת', 'רעננה', 'נהריה', 'לוד', 'רמלה', 'צפת', 'עכו',
      'קריית גת', 'קריית מוצקין', 'טבריה', 'עפולה', 'אילת', 'טירת כרמל',
      'גבעתיים', 'קריית אתא', 'מעלה אדומים', 'אלעד', 'קרית אונו', 'יבנה',
      'קרית ביאליק', 'קרית ים', 'ארד', 'כרמיאל', 'קדימה-צורן', 'בית שמש',
      'נשר', 'אור יהודה', 'נס ציונה', 'זכרון יעקב', 'קרית מלאכי',
      'דימונה', 'מגדל העמק', 'נתיבות', 'אור עקיבא', 'יקנעם עילית',
      'קלנסווה', 'שפרעם', 'הוד השרון', 'ביתר עילית', 'אפרתה'
    ].sort((a, b) => a.localeCompare(b, 'he'));


    res.json({
      success: true,
      cities: fallbackCities,
      count: fallbackCities.length,
      source: 'fallback',
      cached: false,
      error: error.message
    });
  }
});

/**
 * Generic proxy for data.gov.il resources
 */
router.get('/data-gov-il/:resourceId', async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { limit = 1000 } = req.query;


    const options = {
      hostname: 'data.gov.il',
      path: `/api/action/datastore_search?resource_id=${resourceId}&limit=${limit}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Ludora-API/1.0'
      }
    };

    const data = await new Promise((resolve, reject) => {
      const req = https.request(options, (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (error) {
            reject(new Error('Invalid JSON response'));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });

    if (!data.success || !data.result) {
      throw new Error('Invalid response format from data.gov.il');
    }


    res.json({
      success: true,
      data: data.result,
      source: 'data.gov.il'
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      error: error.message,
      resource_id: req.params.resourceId
    });
  }
});

export default router;