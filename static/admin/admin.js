/**
 * Admin Interface Client-Side JavaScript
 * Handles delete confirmation, reordering, and AJAX operations
 */

/**
 * Get CSRF token from meta tag or hidden input
 * @returns {string|null} CSRF token
 */
function getCsrfToken() {
  // Try to get from meta tag
  const metaTag = document.querySelector('meta[name="csrf-token"]');
  if (metaTag) {
    return metaTag.getAttribute('content');
  }
  
  // Try to get from hidden input in any form
  const hiddenInput = document.querySelector('input[name="_csrf"]');
  if (hiddenInput) {
    return hiddenInput.value;
  }
  
  return null;
}

/**
 * Confirm and delete content item
 * @param {string} slug - The content item slug
 * @param {string} title - The content item title
 */
function confirmDelete(slug, title) {
  // Display confirmation modal
  const confirmed = confirm(`Are you sure you want to delete '${title}'? This action cannot be undone.`);
  
  if (!confirmed) {
    return;
  }
  
  const csrfToken = getCsrfToken();
  
  // Send DELETE request to server
  fetch(`/admin/delete/${slug}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    }
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Show success message
      alert('Content deleted successfully');
      // Reload the page to reflect changes
      window.location.reload();
    } else {
      // Show error message
      alert(`Failed to delete content: ${data.error || 'Unknown error'}`);
    }
  })
  .catch(error => {
    console.error('Error deleting content:', error);
    alert('Failed to delete content. Please try again.');
  });
}

/**
 * Handle reorder form submission
 * @param {Event} event - Form submit event
 * @param {string} formId - ID of the form being submitted
 */
function handleReorderSubmit(event, formId) {
  event.preventDefault();
  
  const form = document.getElementById(formId);
  const inputs = form.querySelectorAll('.order-input');
  
  // Collect order updates
  const items = [];
  inputs.forEach(input => {
    items.push({
      slug: input.dataset.slug,
      order: parseInt(input.value, 10) || 0
    });
  });
  
  const csrfToken = getCsrfToken();
  
  // Send POST request to server
  fetch('/admin/reorder', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify({ items })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Show success message
      alert('Order updated successfully');
      // Reload the page to reflect changes
      window.location.reload();
    } else {
      // Show error message
      alert(`Failed to update order: ${data.error || 'Unknown error'}`);
    }
  })
  .catch(error => {
    console.error('Error updating order:', error);
    alert('Failed to update order. Please try again.');
  });
}

// Set up event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Blog entries reorder form
  const blogForm = document.getElementById('reorder-form-blog');
  if (blogForm) {
    blogForm.addEventListener('submit', function(event) {
      handleReorderSubmit(event, 'reorder-form-blog');
    });
  }
  
  // Pages reorder form
  const pagesForm = document.getElementById('reorder-form-pages');
  if (pagesForm) {
    pagesForm.addEventListener('submit', function(event) {
      handleReorderSubmit(event, 'reorder-form-pages');
    });
  }
});
