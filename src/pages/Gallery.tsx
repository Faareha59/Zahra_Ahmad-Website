import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Folder, Image, Film, Plus, Trash2, Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const Gallery = () => {
  const { user } = useAuth();
  const [media, setMedia] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchMedia();
      fetchFolders();
    }
  }, [user, currentFolder]);

  const fetchMedia = async () => {
    try {
      let query = supabase
        .from('photos')
        .select('*')
        .eq('uploaded_by', user?.id)
        .order('created_at', { ascending: false });

      if (currentFolder) {
        query = query.eq('folder_id', currentFolder);
      } else {
        query = query.filter('folder_id', 'is', null);
      }

      const { data, error } = await query;

      if (error) throw error;
      setMedia(data || []);
    } catch (error) {
      console.error('Error fetching media:', error);
    }
  };

  const fetchFolders = async () => {
    try {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFolders(data || []);
    } catch (error) {
      console.error('Error fetching folders:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const isVideo = file.type.startsWith('video/');
    const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    
    if (file.size > maxSize) {
      alert(`File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('photos')
        .upload(filePath, file, {
          onUploadProgress: (progress) => {
            const percent = (progress.loaded / progress.total) * 100;
            setUploadProgress(Math.round(percent));
          },
        });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('photos').insert([
        {
          url: data.path,
          folder_id: currentFolder,
          uploaded_by: user.id,
          media_type: isVideo ? 'video' : 'image'
        },
      ]);

      if (dbError) throw dbError;

      fetchMedia();
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const createFolder = async () => {
    const name = prompt('Enter folder name:');
    if (!name || !user) return;

    try {
      const { error } = await supabase.from('folders').insert([
        {
          name,
          user_id: user.id,
        },
      ]);

      if (error) throw error;
      fetchFolders();
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Error creating folder');
    }
  };

  const deleteFolder = async (folderId: string) => {
    if (!confirm('Are you sure you want to delete this folder and all its contents?')) return;

    try {
      const { error: photosError } = await supabase
        .from('photos')
        .delete()
        .eq('folder_id', folderId);

      if (photosError) throw photosError;

      const { error: folderError } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId);

      if (folderError) throw folderError;

      fetchFolders();
      if (currentFolder === folderId) {
        setCurrentFolder(null);
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
      alert('Error deleting folder');
    }
  };

  const deleteMedia = async (item: any) => {
    if (!confirm('Are you sure you want to delete this media item?')) return;

    try {
      // First delete the file from storage
      const { error: storageError } = await supabase.storage
        .from('photos')
        .remove([item.url]);

      if (storageError) throw storageError;

      // Then delete the database record
      const { error: dbError } = await supabase
        .from('photos')
        .delete()
        .eq('id', item.id);

      if (dbError) throw dbError;

      // Refresh the media list
      fetchMedia();
    } catch (error) {
      console.error('Error deleting media:', error);
      alert('Error deleting media');
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { 
      opacity: 0,
      scale: 0.8,
      y: 20
    },
    show: { 
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        bounce: 0.4
      }
    }
  };

  const folderVariants = {
    hover: { 
      scale: 1.05,
      rotate: [-1, 1, -1, 0],
      transition: {
        rotate: {
          repeat: Infinity,
          duration: 2
        }
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="container mx-auto px-4 py-8"
    >
      <motion.div 
        className="flex justify-between items-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h1 className="text-3xl font-bold text-gray-800">
          {currentFolder ? 'Folder Contents' : 'My Gallery'}
        </h1>
        <div className="flex space-x-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={createFolder}
            className="flex items-center space-x-2 px-4 py-2 bg-pink-500 text-white rounded-full hover:bg-pink-600 transition-colors"
          >
            <Folder className="w-5 h-5" />
            <span>New Folder</span>
          </motion.button>
          
          <motion.label 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center space-x-2 px-4 py-2 ${
              isUploading ? 'bg-gray-400' : 'bg-teal-500 hover:bg-teal-600'
            } text-white rounded-full transition-colors cursor-pointer relative`}
          >
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="hidden"
            />
            <Upload className="w-5 h-5" />
            <span>{isUploading ? 'Uploading...' : 'Upload Media'}</span>
            {uploadProgress > 0 && (
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                className="absolute bottom-0 left-0 h-1 bg-white rounded-full"
              />
            )}
          </motion.label>
        </div>
      </motion.div>

      {/* Folders Grid */}
      {!currentFolder && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8"
        >
          {folders.map((folder) => (
            <motion.div
              key={folder.id}
              variants={itemVariants}
              whileHover="hover"
              className="relative group bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow"
            >
              <motion.button
                variants={folderVariants}
                onClick={() => setCurrentFolder(folder.id)}
                className="w-full text-center"
                onHoverStart={() => setHoveredItem(folder.id)}
                onHoverEnd={() => setHoveredItem(null)}
              >
                <motion.div
                  animate={hoveredItem === folder.id ? {
                    scale: [1, 1.2, 1],
                    rotate: [0, -10, 10, 0],
                  } : {}}
                  transition={{ duration: 0.5 }}
                >
                  <Folder className="w-12 h-12 text-pink-500 mx-auto mb-2" />
                </motion.div>
                <p className="text-gray-800 font-medium truncate">{folder.name}</p>
              </motion.button>
              <motion.button
                initial={{ opacity: 0 }}
                whileHover={{ scale: 1.1 }}
                animate={{ opacity: hoveredItem === folder.id ? 1 : 0 }}
                onClick={() => deleteFolder(folder.id)}
                className="absolute top-2 right-2 p-1 bg-red-100 rounded-full"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </motion.button>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Media Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4"
      >
        <AnimatePresence>
          {media.map((item) => (
            <motion.div
              key={item.id}
              variants={itemVariants}
              layout
              whileHover={{ scale: 1.02 }}
              className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden"
              onHoverStart={() => setHoveredItem(item.id)}
              onHoverEnd={() => setHoveredItem(null)}
            >
              {item.media_type === 'video' ? (
                <video
                  src={`${supabase.storage.from('photos').getPublicUrl(item.url).data.publicUrl}`}
                  className="w-full h-full object-cover"
                  controls
                />
              ) : (
                <img
                  src={`${supabase.storage.from('photos').getPublicUrl(item.url).data.publicUrl}`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: hoveredItem === item.id ? 1 : 0 }}
                className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"
              />
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ 
                  opacity: hoveredItem === item.id ? 1 : 0,
                  scale: hoveredItem === item.id ? 1 : 0.8
                }}
                whileHover={{ scale: 1.1 }}
                onClick={() => deleteMedia(item)}
                className="absolute top-2 right-2 p-2 bg-red-500 rounded-full"
              >
                <Trash2 className="w-4 h-4 text-white" />
              </motion.button>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ 
                  opacity: hoveredItem === item.id ? 1 : 0,
                  y: hoveredItem === item.id ? 0 : 20
                }}
                className="absolute bottom-2 left-2"
              >
                <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {currentFolder && (
        <motion.button
          initial={{ scale: 0, rotate: 180 }}
          animate={{ scale: 1, rotate: 0 }}
          whileHover={{ scale: 1.1, rotate: -180 }}
          onClick={() => setCurrentFolder(null)}
          className="fixed bottom-8 right-8 bg-pink-500 text-white p-4 rounded-full shadow-lg hover:bg-pink-600 transition-colors"
        >
          <Plus className="w-6 h-6" />
        </motion.button>
      )}
    </motion.div>
  );
};

export default Gallery;