# Requirements Document

## Introduction

This document specifies the requirements for a lightweight markdown-based blog and website system designed to run on resource-constrained Linux systems such as Raspberry Pi. The system enables content creation and management through markdown files without requiring a database, supports Google OAuth authentication, and provides theme customization capabilities.

## Glossary

- **System**: The markdown blog and website application
- **User**: An authenticated person who can create, edit, and manage content
- **Visitor**: An unauthenticated person who can view published content
- **Markdown File**: A text file with .md extension containing formatted content
- **Blog Entry**: A markdown file representing a blog post with metadata
- **Page**: A standalone markdown file representing static content
- **Theme**: A collection of templates and stylesheets that define the visual presentation
- **Content Directory**: The file system location where markdown files are stored
- **Admin Interface**: The backend management interface for authenticated users

## Requirements

### Requirement 1

**User Story:** As a visitor, I want to view rendered markdown content as HTML pages, so that I can read blog posts and pages in a formatted, readable manner.

#### Acceptance Criteria

1. WHEN a visitor requests a markdown file path, THE System SHALL render the markdown content as HTML and return it with the active theme applied
2. THE System SHALL index all markdown files in the Content Directory and make them accessible via URL paths
3. WHEN a markdown file contains front matter metadata, THE System SHALL parse and use the metadata for rendering context
4. THE System SHALL serve static assets (images, CSS, JavaScript) referenced in markdown files
5. IF a requested markdown file does not exist, THEN THE System SHALL return a 404 error page with the active theme applied

### Requirement 2

**User Story:** As a user, I want to log in using my Google account, so that I can securely access the admin interface without managing separate credentials.

#### Acceptance Criteria

1. THE System SHALL provide a login page with a Google OAuth authentication option
2. WHEN a visitor clicks the Google login button, THE System SHALL redirect to Google's OAuth consent screen
3. WHEN Google OAuth authentication succeeds, THE System SHALL create an authenticated session for the user
4. THE System SHALL restrict access to the Admin Interface to authenticated users only
5. IF an unauthenticated visitor attempts to access the Admin Interface, THEN THE System SHALL redirect to the login page

### Requirement 3

**User Story:** As a user, I want to create new markdown files through the admin interface, so that I can add new blog entries or pages without directly accessing the file system.

#### Acceptance Criteria

1. WHEN a user selects "create new" in the Admin Interface, THE System SHALL present a form with fields for title, content, and type (blog entry or page)
2. WHEN a user submits the creation form, THE System SHALL generate a new markdown file in the Content Directory with appropriate front matter
3. THE System SHALL assign a unique filename based on the title and timestamp for blog entries
4. THE System SHALL validate that the markdown content is well-formed before saving
5. WHEN a new markdown file is created, THE System SHALL update the content index immediately

### Requirement 4

**User Story:** As a user, I want to edit existing markdown files through the admin interface, so that I can update content without using external text editors.

#### Acceptance Criteria

1. WHEN a user selects a markdown file in the Admin Interface, THE System SHALL display an edit form with the current content and metadata
2. WHEN a user submits changes, THE System SHALL update the markdown file in the Content Directory
3. THE System SHALL preserve the original filename when editing existing content
4. THE System SHALL validate markdown syntax before saving changes
5. WHEN a markdown file is updated, THE System SHALL refresh the content index immediately

### Requirement 5

**User Story:** As a user, I want to delete markdown files through the admin interface, so that I can remove outdated or unwanted content.

#### Acceptance Criteria

1. WHEN a user selects delete for a markdown file, THE System SHALL prompt for confirmation before proceeding
2. WHEN a user confirms deletion, THE System SHALL remove the markdown file from the Content Directory
3. THE System SHALL remove the deleted file from the content index immediately
4. THE System SHALL log all deletion operations with timestamp and user information
5. IF a deletion operation fails, THEN THE System SHALL display an error message and leave the file unchanged

### Requirement 6

**User Story:** As a user, I want to reorder blog entries and pages, so that I can control the display sequence of content.

#### Acceptance Criteria

1. THE System SHALL display a list of all markdown files with drag-and-drop or numeric ordering controls in the Admin Interface
2. WHEN a user changes the order of items, THE System SHALL update the ordering metadata for affected files
3. THE System SHALL persist the ordering information in the markdown file front matter or a separate index file
4. WHEN visitors view the blog or page list, THE System SHALL display items according to the user-defined order
5. THE System SHALL provide a default ordering by creation date for new content

### Requirement 7

**User Story:** As a user, I want to switch between different themes, so that I can change the visual appearance of the website without modifying content.

#### Acceptance Criteria

1. THE System SHALL store available themes in a dedicated themes directory
2. THE System SHALL provide a theme selector in the Admin Interface showing all available themes
3. WHEN a user selects a different theme, THE System SHALL update the active theme configuration
4. THE System SHALL apply the selected theme to all rendered pages immediately without requiring a restart
5. WHERE a theme is missing required template files, THE System SHALL fall back to a default theme and log a warning

### Requirement 8

**User Story:** As a system administrator, I want the system to run efficiently on a Raspberry Pi with Linux, so that I can host my website on low-cost, energy-efficient hardware.

#### Acceptance Criteria

1. THE System SHALL be implemented using cross-platform technologies compatible with Linux ARM architecture
2. THE System SHALL operate with a maximum memory footprint of 256MB under normal load
3. THE System SHALL use file-based storage exclusively without requiring a database server
4. THE System SHALL start up within 10 seconds on a Raspberry Pi 3 or newer
5. WHEN serving static content, THE System SHALL respond to requests within 200ms on a Raspberry Pi 3 or newer

### Requirement 9

**User Story:** As a developer, I want the system to use inline code or code-behind patterns instead of MVC, so that the architecture remains simple and easy to understand.

#### Acceptance Criteria

1. THE System SHALL implement request handling using inline code or code-behind files rather than MVC controller classes
2. THE System SHALL colocate view logic with request handlers where appropriate
3. THE System SHALL avoid framework-imposed separation of concerns that adds unnecessary complexity
4. THE System SHALL use direct file system operations for content management rather than repository abstractions
5. THE System SHALL maintain clear separation between authentication logic and content rendering logic

### Requirement 10

**User Story:** As a user, I want the system to automatically index markdown files, so that new or modified content appears on the website without manual intervention.

#### Acceptance Criteria

1. WHEN the System starts, THE System SHALL scan the Content Directory and build an index of all markdown files
2. THE System SHALL monitor the Content Directory for file system changes during runtime
3. WHEN a markdown file is added, modified, or deleted outside the Admin Interface, THE System SHALL update the index within 5 seconds
4. THE System SHALL extract metadata from markdown front matter during indexing
5. THE System SHALL maintain the index in memory for fast access during request handling
