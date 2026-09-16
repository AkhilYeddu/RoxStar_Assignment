import React, { useState } from 'react';
import { AudioPlayer } from './AudioPlayer';
import { api } from '../services/api';
import {
  Folder,
  Trash2,
  Share2,
  Clock,
  Music,
  Filter,
  Search,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export const DraftList = ({ drafts = [], onDraftDeleted, onShareToRoom, loading }) => {
  const [filterEffect, setFilterEffect] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [sharedDraftId, setSharedDraftId] = useState(null);

  const handleDeleteClick = async (draft) => {
    const targetId = draft._id || draft.id;
    if (!targetId) return;

    // First click -> Enter confirmation state
    if (confirmDeleteId !== targetId) {
      setConfirmDeleteId(targetId);
      setTimeout(() => {
        setConfirmDeleteId((cur) => (cur === targetId ? null : cur));
      }, 4500);
      return;
    }

    // Second click -> Execute deletion
    try {
      setDeletingId(targetId);
      setDeleteError('');
      await api.deleteDraft(targetId);
      setConfirmDeleteId(null);
      if (onDraftDeleted) {
        onDraftDeleted(targetId);
      }
    } catch (err) {
      console.error('Delete draft error:', err);
      setDeleteError(err.message || 'Failed to delete draft');
    } finally {
      setDeletingId(null);
    }
  };

  const handleShare = (draft) => {
    setSharedDraftId(draft._id);
    if (onShareToRoom) {
      onShareToRoom(draft);
    }
    setTimeout(() => {
      setSharedDraftId(null);
    }, 3000);
  };

  // Filter & search logic
  const filteredDrafts = drafts.filter((draft) => {
    const matchesEffect =
      filterEffect === 'all' ||
      (filterEffect === 'clean' && (!draft.effectApplied || draft.effectApplied === 'none')) ||
      draft.effectApplied === filterEffect;

    const matchesSearch =
      !searchTerm ||
      draft.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (draft.createdBy && draft.createdBy.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesEffect && matchesSearch;
  });

  const getEffectBadgeClass = (effect) => {
    switch (effect) {
      case 'echo':
        return 'badge-echo';
      case 'reverb':
        return 'badge-reverb';
      case 'pitch_shift':
        return 'badge-pitch';
      case 'custom':
        return 'badge-custom';
      default:
        return 'badge-clean';
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="draft-library-container" id="draft-library">
      <div className="library-header">
        <div className="library-title-row">
          <div className="library-title">
            <Folder className="library-icon" size={22} />
            <h2>Draft Management Studio</h2>
            <span className="draft-count-pill">{drafts.length} saved</span>
          </div>

          <div className="search-filter-box">
            <div className="search-input-wrapper">
              <Search size={15} className="search-icon" />
              <input
                type="text"
                placeholder="Search drafts by title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                id="search-drafts-input"
              />
            </div>
          </div>
        </div>

        {deleteError && (
          <div className="studio-alert-error" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{deleteError}</span>
            <button type="button" onClick={() => setDeleteError('')} className="alert-dismiss-btn" style={{ marginLeft: 'auto' }}>✕</button>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="filter-tabs-row">
          <div className="filter-tabs">
            {[
              { id: 'all', label: 'All Drafts' },
              { id: 'echo', label: 'Echo' },
              { id: 'reverb', label: 'Reverb' },
              { id: 'pitch_shift', label: 'Pitch Shift' },
              { id: 'clean', label: 'Clean (Dry)' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`filter-tab-btn ${filterEffect === tab.id ? 'active' : ''}`}
                onClick={() => setFilterEffect(tab.id)}
                id={`filter-${tab.id}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your saved drafts...</p>
        </div>
      ) : filteredDrafts.length === 0 ? (
        <div className="empty-library-state">
          <Music size={42} className="empty-icon" />
          <h3>No Drafts Found</h3>
          <p>
            {drafts.length === 0
              ? 'Record your first vocal take above and click "Save Draft" to build your library!'
              : 'No drafts match the current filter or search criteria.'}
          </p>
        </div>
      ) : (
        <div className="drafts-grid">
          {filteredDrafts.map((draft) => (
            <div className="draft-card" key={draft._id} id={`draft-card-${draft._id}`}>
              <div className="draft-card-header">
                <div className="draft-meta-left">
                  <h4 className="draft-card-title">{draft.title}</h4>
                  <div className="draft-meta-details">
                    <span className="draft-author">{draft.createdBy || 'Artist'}</span>
                    <span className="meta-bullet">•</span>
                    <span className="draft-time">
                      <Clock size={12} />
                      {formatDate(draft.createdAt)}
                    </span>
                    <span className="meta-bullet">•</span>
                    <span className="draft-duration-badge">
                      {formatDuration(draft.duration)}
                    </span>
                  </div>
                </div>

                <div className="draft-badges-right">
                  <span className={`effect-badge ${getEffectBadgeClass(draft.effectApplied)}`}>
                    {draft.effectApplied?.toUpperCase() || 'CLEAN'}
                  </span>
                </div>
              </div>

              {/* Audio player connected to streaming URL */}
              <div className="draft-player-container">
                <AudioPlayer
                  src={api.getAudioUrl(draft.fileUrl || draft.fileName)}
                  peaks={draft.waveformPeaks}
                  title={draft.title}
                  duration={draft.duration}
                />
              </div>

              {/* Card Footer Actions */}
              <div className="draft-card-actions">
                <button
                  type="button"
                  className={`share-draft-btn ${sharedDraftId === draft._id ? 'shared-success' : ''}`}
                  onClick={() => handleShare(draft)}
                  id={`share-draft-${draft._id}`}
                  title="Share draft to real-time room (Phase 2 capability)"
                >
                  {sharedDraftId === draft._id ? (
                    <>
                      <CheckCircle size={15} />
                      <span>Ready for Room Broadcast!</span>
                    </>
                  ) : (
                    <>
                      <Share2 size={15} />
                      <span>Share to Room</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className={`delete-draft-btn ${confirmDeleteId === (draft._id || draft.id) ? 'confirming-delete' : ''}`}
                  onClick={() => handleDeleteClick(draft)}
                  disabled={deletingId === (draft._id || draft.id)}
                  id={`delete-draft-${draft._id || draft.id}`}
                  title={confirmDeleteId === (draft._id || draft.id) ? 'Click again to permanently delete' : 'Delete this draft'}
                >
                  {confirmDeleteId === (draft._id || draft.id) ? (
                    <>
                      <AlertCircle size={15} className="pulse-icon" />
                      <span>Confirm Delete?</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={15} />
                      <span>{deletingId === (draft._id || draft.id) ? 'Deleting...' : 'Delete'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
