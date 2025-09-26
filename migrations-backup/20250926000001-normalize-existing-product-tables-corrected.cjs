'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    // 1. Add video_file_url to Workshop table if it doesn't exist
    const workshopTable = await queryInterface.describeTable('workshop');
    if (!workshopTable.video_file_url) {
      await queryInterface.addColumn('workshop', 'video_file_url', {
        type: DataTypes.STRING,
        allowNull: true
      });
    }

    // 2. Add foreign key relationships to existing tables if they don't exist
    // Course table - add product_id foreign key
    const courseConstraints = await queryInterface.getForeignKeyReferencesForTable('course');
    const hasProductFK = courseConstraints.some(constraint =>
      constraint.referencedTableName === 'product'
    );

    if (!hasProductFK) {
      const courseTableDesc = await queryInterface.describeTable('course');
      if (!courseTableDesc.product_id) {
        await queryInterface.addColumn('course', 'product_id', {
          type: DataTypes.STRING,
          allowNull: true,
          references: {
            model: 'product',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        });
      }
    }

    // Workshop table - add product_id foreign key
    const workshopConstraints = await queryInterface.getForeignKeyReferencesForTable('workshop');
    const hasWorkshopProductFK = workshopConstraints.some(constraint =>
      constraint.referencedTableName === 'product'
    );

    if (!hasWorkshopProductFK) {
      const workshopTableDesc = await queryInterface.describeTable('workshop');
      if (!workshopTableDesc.product_id) {
        await queryInterface.addColumn('workshop', 'product_id', {
          type: DataTypes.STRING,
          allowNull: true,
          references: {
            model: 'product',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        });
      }
    }

    // File table - add product_id foreign key
    const fileConstraints = await queryInterface.getForeignKeyReferencesForTable('file');
    const hasFileProductFK = fileConstraints.some(constraint =>
      constraint.referencedTableName === 'product'
    );

    if (!hasFileProductFK) {
      const fileTableDesc = await queryInterface.describeTable('file');
      if (!fileTableDesc.product_id) {
        await queryInterface.addColumn('file', 'product_id', {
          type: DataTypes.STRING,
          allowNull: true,
          references: {
            model: 'product',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        });
      }
    }

    // 3. Make youtube_video_id and youtube_video_title nullable in Product table
    const productTable = await queryInterface.describeTable('product');
    if (productTable.youtube_video_id && productTable.youtube_video_id.allowNull === false) {
      await queryInterface.changeColumn('product', 'youtube_video_id', {
        type: DataTypes.STRING,
        allowNull: true
      });
    }

    if (productTable.youtube_video_title && productTable.youtube_video_title.allowNull === false) {
      await queryInterface.changeColumn('product', 'youtube_video_title', {
        type: DataTypes.STRING,
        allowNull: true
      });
    }

    // 4. Update access_days to allow null for lifetime access
    if (productTable.access_days && productTable.access_days.allowNull === false) {
      await queryInterface.changeColumn('product', 'access_days', {
        type: DataTypes.DECIMAL,
        allowNull: true
      });
    }

    // 5. Migrate existing data from Product to respective tables
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Get all products with their data
      const products = await queryInterface.sequelize.query(
        'SELECT * FROM product',
        { type: queryInterface.sequelize.QueryTypes.SELECT, transaction }
      );

      for (const product of products) {
        const productId = product.id;

        // Migrate course-specific data if this product is a course
        if (product.product_type === 'course') {
          // Check if course entry already exists for this product
          const existingCourse = await queryInterface.sequelize.query(
            'SELECT id FROM course WHERE id = :id OR product_id = :product_id',
            {
              replacements: { id: productId, product_id: productId },
              type: queryInterface.sequelize.QueryTypes.SELECT,
              transaction
            }
          );

          if (existingCourse.length === 0) {
            // Create new course entry linking to product
            await queryInterface.sequelize.query(
              `INSERT INTO course (id, product_id, course_modules, total_duration_minutes, created_at, updated_at,
                                  title, description, category, price, is_published, image_url, tags, target_audience,
                                  access_days, is_lifetime_access, creator_user_id)
               VALUES (:id, :product_id, :course_modules, :total_duration_minutes, NOW(), NOW(),
                      :title, :description, :category, :price, :is_published, :image_url, :tags, :target_audience,
                      :access_days, :is_lifetime_access, :creator_user_id)`,
              {
                replacements: {
                  id: productId,
                  product_id: productId,
                  course_modules: product.course_modules || '[]',
                  total_duration_minutes: product.total_duration_minutes,
                  title: product.title,
                  description: product.description,
                  category: product.category,
                  price: product.price,
                  is_published: product.is_published,
                  image_url: product.image_url,
                  tags: JSON.stringify(product.tags || []),
                  target_audience: product.target_audience,
                  access_days: product.access_days,
                  is_lifetime_access: product.is_lifetime_access,
                  creator_user_id: product.creator_user_id
                },
                transaction
              }
            );
          } else {
            // Update existing course entry with product_id
            await queryInterface.sequelize.query(
              'UPDATE course SET product_id = :product_id WHERE id = :id',
              {
                replacements: { product_id: productId, id: existingCourse[0].id },
                transaction
              }
            );
          }
        }

        // Migrate workshop-specific data if this product is a workshop
        if (product.product_type === 'workshop') {
          const existingWorkshop = await queryInterface.sequelize.query(
            'SELECT id FROM workshop WHERE id = :id OR product_id = :product_id',
            {
              replacements: { id: productId, product_id: productId },
              type: queryInterface.sequelize.QueryTypes.SELECT,
              transaction
            }
          );

          if (existingWorkshop.length === 0) {
            await queryInterface.sequelize.query(
              `INSERT INTO workshop (id, product_id, workshop_type, scheduled_date, meeting_link, meeting_password,
                                   meeting_platform, max_participants, duration_minutes, video_file_url, created_at, updated_at,
                                   title, description, category, price, is_published, image_url, tags, target_audience,
                                   access_days, is_lifetime_access, creator_user_id)
               VALUES (:id, :product_id, :workshop_type, :scheduled_date, :meeting_link, :meeting_password,
                      :meeting_platform, :max_participants, :duration_minutes, :video_file_url, NOW(), NOW(),
                      :title, :description, :category, :price, :is_published, :image_url, :tags, :target_audience,
                      :access_days, :is_lifetime_access, :creator_user_id)`,
              {
                replacements: {
                  id: productId,
                  product_id: productId,
                  workshop_type: product.workshop_type,
                  scheduled_date: product.scheduled_date,
                  meeting_link: product.meeting_link,
                  meeting_password: product.meeting_password,
                  meeting_platform: product.meeting_platform,
                  max_participants: product.max_participants,
                  duration_minutes: product.duration_minutes,
                  video_file_url: product.video_file_url,
                  title: product.title,
                  description: product.description,
                  category: product.category,
                  price: product.price,
                  is_published: product.is_published,
                  image_url: product.image_url,
                  tags: JSON.stringify(product.tags || []),
                  target_audience: product.target_audience,
                  access_days: product.access_days,
                  is_lifetime_access: product.is_lifetime_access,
                  creator_user_id: product.creator_user_id
                },
                transaction
              }
            );
          } else {
            // Update existing workshop with video_file_url and product_id
            await queryInterface.sequelize.query(
              'UPDATE workshop SET product_id = :product_id, video_file_url = :video_file_url WHERE id = :id',
              {
                replacements: {
                  product_id: productId,
                  id: existingWorkshop[0].id,
                  video_file_url: product.video_file_url
                },
                transaction
              }
            );
          }
        }

        // Migrate file-specific data if this product is a file, tool, or game
        if (['file', 'tool', 'game'].includes(product.product_type)) {
          const existingFile = await queryInterface.sequelize.query(
            'SELECT id FROM file WHERE id = :id OR product_id = :product_id',
            {
              replacements: { id: productId, product_id: productId },
              type: queryInterface.sequelize.QueryTypes.SELECT,
              transaction
            }
          );

          if (existingFile.length === 0) {
            await queryInterface.sequelize.query(
              `INSERT INTO file (id, product_id, file_url, file_type, created_at, updated_at,
                               title, description, category, price, is_published, image_url, tags,
                               target_audience, access_days, is_lifetime_access, creator_user_id)
               VALUES (:id, :product_id, :file_url, :file_type, NOW(), NOW(),
                      :title, :description, :category, :price, :is_published, :image_url, :tags,
                      :target_audience, :access_days, :is_lifetime_access, :creator_user_id)`,
              {
                replacements: {
                  id: productId,
                  product_id: productId,
                  file_url: product.file_url,
                  file_type: product.file_type,
                  title: product.title,
                  description: product.description,
                  category: product.category,
                  price: product.price,
                  is_published: product.is_published,
                  image_url: product.image_url,
                  tags: JSON.stringify(product.tags || []),
                  target_audience: product.target_audience,
                  access_days: product.access_days,
                  is_lifetime_access: product.is_lifetime_access,
                  creator_user_id: product.creator_user_id
                },
                transaction
              }
            );
          } else {
            // Update existing file entry with product_id
            await queryInterface.sequelize.query(
              'UPDATE file SET product_id = :product_id WHERE id = :id',
              {
                replacements: { product_id: productId, id: existingFile[0].id },
                transaction
              }
            );
          }
        }

        // Update lifetime access logic: set access_days to null where is_lifetime_access is true
        if (product.is_lifetime_access === true) {
          await queryInterface.sequelize.query(
            'UPDATE product SET access_days = NULL WHERE id = :id',
            {
              replacements: { id: productId },
              transaction
            }
          );
        }
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    // 6. Remove the migrated columns from product table
    const columnsToRemove = [
      'course_modules',           // Moved to Course table
      'total_duration_minutes',   // Moved to Course table
      'workshop_type',           // Moved to Workshop table
      'scheduled_date',          // Moved to Workshop table
      'meeting_link',            // Moved to Workshop table
      'meeting_password',        // Moved to Workshop table
      'meeting_platform',        // Moved to Workshop table
      'max_participants',        // Moved to Workshop table
      'duration_minutes',        // Moved to Workshop table
      'file_url',                // Moved to File table
      'file_type',               // Moved to File table
      'video_file_url',          // Moved to Workshop table
      'preview_file_url',        // Removed completely
      'downloads_count',         // Removed completely
      'is_lifetime_access',      // Removed completely (using access_days = NULL)
      'workshop_id'              // Removed completely
    ];

    for (const column of columnsToRemove) {
      const currentTable = await queryInterface.describeTable('product');
      if (currentTable[column]) {
        await queryInterface.removeColumn('product', column);
      }
    }

    // 7. Add indexes for better performance on foreign keys
    await queryInterface.addIndex('course', ['product_id'], {
      name: 'course_product_id_idx',
      concurrently: true
    });
    await queryInterface.addIndex('workshop', ['product_id'], {
      name: 'workshop_product_id_idx',
      concurrently: true
    });
    await queryInterface.addIndex('file', ['product_id'], {
      name: 'file_product_id_idx',
      concurrently: true
    });
  },

  async down(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    // This rollback recreates the original structure in Product table
    const columnsToAdd = {
      course_modules: { type: DataTypes.JSONB, defaultValue: [] },
      total_duration_minutes: { type: DataTypes.DECIMAL },
      workshop_type: { type: DataTypes.STRING },
      scheduled_date: { type: DataTypes.DATE },
      meeting_link: { type: DataTypes.STRING },
      meeting_password: { type: DataTypes.STRING },
      meeting_platform: { type: DataTypes.STRING },
      max_participants: { type: DataTypes.INTEGER },
      duration_minutes: { type: DataTypes.INTEGER },
      file_url: { type: DataTypes.STRING },
      file_type: { type: DataTypes.STRING },
      video_file_url: { type: DataTypes.STRING },
      preview_file_url: { type: DataTypes.STRING },
      downloads_count: { type: DataTypes.DECIMAL, defaultValue: 0 },
      is_lifetime_access: { type: DataTypes.BOOLEAN },
      workshop_id: { type: DataTypes.STRING }
    };

    for (const [column, definition] of Object.entries(columnsToAdd)) {
      const currentTable = await queryInterface.describeTable('product');
      if (!currentTable[column]) {
        await queryInterface.addColumn('product', column, definition);
      }
    }

    // Migrate data back from normalized tables to Product table
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Get all courses and migrate back
      const courses = await queryInterface.sequelize.query(
        'SELECT * FROM course WHERE product_id IS NOT NULL',
        { type: queryInterface.sequelize.QueryTypes.SELECT, transaction }
      );

      for (const course of courses) {
        await queryInterface.sequelize.query(
          'UPDATE product SET course_modules = :course_modules, total_duration_minutes = :total_duration_minutes WHERE id = :id',
          {
            replacements: {
              id: course.product_id,
              course_modules: course.course_modules,
              total_duration_minutes: course.total_duration_minutes
            },
            transaction
          }
        );
      }

      // Get all workshops and migrate back
      const workshops = await queryInterface.sequelize.query(
        'SELECT * FROM workshop WHERE product_id IS NOT NULL',
        { type: queryInterface.sequelize.QueryTypes.SELECT, transaction }
      );

      for (const workshop of workshops) {
        await queryInterface.sequelize.query(
          `UPDATE product SET workshop_type = :workshop_type, scheduled_date = :scheduled_date,
                              meeting_link = :meeting_link, meeting_password = :meeting_password,
                              meeting_platform = :meeting_platform, max_participants = :max_participants,
                              duration_minutes = :duration_minutes, video_file_url = :video_file_url
           WHERE id = :id`,
          {
            replacements: {
              id: workshop.product_id,
              workshop_type: workshop.workshop_type,
              scheduled_date: workshop.scheduled_date,
              meeting_link: workshop.meeting_link,
              meeting_password: workshop.meeting_password,
              meeting_platform: workshop.meeting_platform,
              max_participants: workshop.max_participants,
              duration_minutes: workshop.duration_minutes,
              video_file_url: workshop.video_file_url
            },
            transaction
          }
        );
      }

      // Get all files and migrate back
      const files = await queryInterface.sequelize.query(
        'SELECT * FROM file WHERE product_id IS NOT NULL',
        { type: queryInterface.sequelize.QueryTypes.SELECT, transaction }
      );

      for (const file of files) {
        await queryInterface.sequelize.query(
          'UPDATE product SET file_url = :file_url, file_type = :file_type WHERE id = :id',
          {
            replacements: {
              id: file.product_id,
              file_url: file.file_url,
              file_type: file.file_type
            },
            transaction
          }
        );
      }

      // Convert null access_days back to is_lifetime_access = true
      await queryInterface.sequelize.query(
        'UPDATE product SET is_lifetime_access = true WHERE access_days IS NULL',
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    // Remove the indexes
    await queryInterface.removeIndex('course', 'course_product_id_idx');
    await queryInterface.removeIndex('workshop', 'workshop_product_id_idx');
    await queryInterface.removeIndex('file', 'file_product_id_idx');

    // Remove product_id foreign key columns from existing tables
    await queryInterface.removeColumn('course', 'product_id');
    await queryInterface.removeColumn('workshop', 'product_id');
    await queryInterface.removeColumn('file', 'product_id');

    // Remove video_file_url from workshop table
    await queryInterface.removeColumn('workshop', 'video_file_url');

    // Revert youtube fields to not allow null
    await queryInterface.changeColumn('product', 'youtube_video_id', {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: ''
    });

    await queryInterface.changeColumn('product', 'youtube_video_title', {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: ''
    });

    // Revert access_days to not allow null
    await queryInterface.changeColumn('product', 'access_days', {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 0
    });
  }
};