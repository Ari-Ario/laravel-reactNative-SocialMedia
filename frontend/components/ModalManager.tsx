import React from 'react';
import { useModal } from '@/context/ModalContext';
import CreatePost from './CreatePost'; // Use your exact component name
// ... other modal imports ...
// import EditPostModal from './EditPostModal';
// import DeleteConfirmationModal from './DeleteConfirmationModal';
import ReportPost from './ReportPost';
import ProfilePreview from './ProfilePreview';

export default function ModalManager() {
  const { modalType, modalProps, closeModal } = useModal();

  switch (modalType) {
    case 'edit':
      return (
        <CreatePost 
          visible={true}
          onClose={closeModal}
          onPostCreated={() => {
            closeModal();
            modalProps?.onPostCreated?.(); // Call any post-creation callback
          }}
          // Pass edit-specific params through route params
          initialParams={{
            postId: modalProps?.postId,
            caption: modalProps?.initialCaption,
            media: JSON.stringify(modalProps?.initialMedia || [])
          }}
        />
      );
    // ... other cases ...
    case 'create':
      return <CreatePost visible={true} onClose={closeModal} {...modalProps} />;
    case 'delete':
      return <DeleteConfirmationModal visible={true} onClose={closeModal} {...modalProps} />;
    case 'report':
      return <ReportPost visible={true} onClose={closeModal} {...modalProps} />;
    case 'profile':
      return <ProfilePreview visible={true} onClose={closeModal} {...modalProps} />;
    default:
      return null;
  }
}

