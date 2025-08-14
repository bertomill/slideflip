"""
Theme Service for theme management and styling preferences
Updated to focus only on visual styling, not content generation
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
import json

logger = logging.getLogger(__name__)


class ThemeService:
    """
    Service for managing themes and visual styling preferences
    Focuses ONLY on styling elements like colors, fonts, and layout styles
    Does NOT generate content - content comes from uploaded files and user description
    """

    def __init__(self):
        # Predefined themes with their visual styling properties
        self.available_themes = {
            "professional": {
                "theme_id": "professional",
                "theme_name": "Professional",
                "theme_description": "Clean, corporate design suitable for business presentations",
                "color_palette": ["#2E86AB", "#A23B72", "#F18F01", "#C73E1D", "#FFFFFF"],
                "preview_text": "Professional and polished",
                "font_family": "Arial, sans-serif",
                "layout_style": "structured",
                "accent_colors": ["#2E86AB", "#A23B72"],
                "background_style": "gradient",
                "text_contrast": "high",
                "visual_hierarchy": "clear"
            },
            "modern": {
                "theme_id": "modern",
                "theme_name": "Modern",
                "theme_description": "Contemporary design with bold colors and clean lines",
                "color_palette": ["#6366F1", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981"],
                "preview_text": "Bold and contemporary",
                "font_family": "Inter, sans-serif",
                "layout_style": "minimalist",
                "accent_colors": ["#6366F1", "#EC4899"],
                "background_style": "gradient",
                "text_contrast": "medium",
                "visual_hierarchy": "subtle"
            },
            "creative": {
                "theme_id": "creative",
                "theme_name": "Creative",
                "theme_description": "Artistic and expressive design for creative presentations",
                "color_palette": ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7"],
                "preview_text": "Artistic and vibrant",
                "font_family": "Poppins, sans-serif",
                "layout_style": "dynamic",
                "accent_colors": ["#FF6B6B", "#4ECDC4"],
                "background_style": "pattern",
                "text_contrast": "medium",
                "visual_hierarchy": "expressive"
            },
            "minimal": {
                "theme_id": "minimal",
                "theme_name": "Minimal",
                "theme_description": "Simple, clean design focusing on content",
                "color_palette": ["#000000", "#FFFFFF", "#F3F4F6", "#6B7280", "#374151"],
                "preview_text": "Simple and clean",
                "font_family": "Helvetica, sans-serif",
                "layout_style": "minimalist",
                "accent_colors": ["#000000", "#6B7280"],
                "background_style": "solid",
                "text_contrast": "high",
                "visual_hierarchy": "minimal"
            },
            "elegant": {
                "theme_id": "elegant",
                "theme_name": "Elegant",
                "theme_description": "Sophisticated design with refined aesthetics",
                "color_palette": ["#8B4513", "#D2691E", "#DEB887", "#F5DEB3", "#FFFFFF"],
                "preview_text": "Sophisticated and refined",
                "font_family": "Georgia, serif",
                "layout_style": "classic",
                "accent_colors": ["#8B4513", "#D2691E"],
                "background_style": "texture",
                "text_contrast": "medium",
                "visual_hierarchy": "refined"
            }
        }

        # Client theme selections and preferences
        self.client_themes: Dict[str, Dict[str, Any]] = {}
        self.client_preferences: Dict[str, Dict[str, Any]] = {}

    async def store_theme_selection(
        self,
        client_id: str,
        theme_data: Dict[str, Any]
    ) -> bool:
        """
        Store theme selection and styling preferences for a client
        Theme is used ONLY for visual styling, not content generation

        Args:
            client_id: Client identifier
            theme_data: Theme selection data (styling only)

        Returns:
            True if theme was stored successfully
        """
        try:
            # Validate theme data
            if not self._validate_theme_data(theme_data):
                logger.error(f"Invalid theme data for client {client_id}")
                return False

            # Store theme selection with styling information only
            theme_info = {
                "theme_id": theme_data.get("theme_id"),
                "theme_name": theme_data.get("theme_name"),
                "color_palette": theme_data.get("color_palette", []),
                "font_family": theme_data.get("font_family", "Arial, sans-serif"),
                "layout_style": theme_data.get("layout_style", "structured"),
                "background_style": theme_data.get("background_style", "gradient"),
                "text_contrast": theme_data.get("text_contrast", "medium"),
                "visual_hierarchy": theme_data.get("visual_hierarchy", "clear"),
                "selected_at": datetime.now().isoformat()
            }

            self.client_themes[client_id] = theme_info
            logger.info(f"Stored theme selection for client {client_id}: {theme_data.get('theme_id')}")
            return True

        except Exception as e:
            logger.error(f"Error storing theme selection for client {client_id}: {e}")
            return False

    async def get_theme_selection(self, client_id: str) -> Optional[Dict[str, Any]]:
        """
        Get stored theme selection for a client
        Returns styling information only, not content

        Args:
            client_id: Client identifier

        Returns:
            Theme styling information or None if not found
        """
        return self.client_themes.get(client_id)

    async def get_available_themes(self) -> List[Dict[str, Any]]:
        """
        Get list of available themes with styling information
        Themes contain visual styling only, not content

        Returns:
            List of available themes with styling properties
        """
        return list(self.available_themes.values())

    async def get_theme_by_id(self, theme_id: str) -> Optional[Dict[str, Any]]:
        """
        Get theme by ID with styling information
        Theme contains visual styling only, not content

        Args:
            theme_id: Theme identifier

        Returns:
            Theme styling information or None if not found
        """
        return self.available_themes.get(theme_id.lower())

    async def create_custom_theme(
        self,
        client_id: str,
        theme_data: Dict[str, Any]
    ) -> bool:
        """
        Create a custom theme for a client
        Custom themes contain styling information only, not content

        Args:
            client_id: Client identifier
            theme_data: Custom theme styling data

        Returns:
            True if custom theme was created successfully
        """
        try:
            # Validate custom theme data
            if not self._validate_custom_theme_data(theme_data):
                logger.error(f"Invalid custom theme data for client {client_id}")
                return False

            # Create custom theme with styling information only
            custom_theme = {
                "theme_id": f"custom_{client_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "theme_name": theme_data.get("theme_name", "Custom Theme"),
                "theme_description": "Custom theme created by user",
                "color_palette": theme_data.get("color_palette", ["#667eea", "#764ba2", "#f093fb"]),
                "font_family": theme_data.get("font_family", "Arial, sans-serif"),
                "layout_style": theme_data.get("layout_style", "structured"),
                "background_style": theme_data.get("background_style", "gradient"),
                "text_contrast": theme_data.get("text_contrast", "medium"),
                "visual_hierarchy": theme_data.get("visual_hierarchy", "clear"),
                "is_custom": True,
                "created_at": datetime.now().isoformat()
            }

            # Store custom theme
            if client_id not in self.client_preferences:
                self.client_preferences[client_id] = {}
            
            if "custom_themes" not in self.client_preferences[client_id]:
                self.client_preferences[client_id]["custom_themes"] = []
            
            self.client_preferences[client_id]["custom_themes"].append(custom_theme)
            
            logger.info(f"Created custom theme for client {client_id}: {custom_theme['theme_id']}")
            return True

        except Exception as e:
            logger.error(f"Error creating custom theme for client {client_id}: {e}")
            return False

    async def get_custom_themes(self, client_id: str) -> List[Dict[str, Any]]:
        """
        Get custom themes for a client
        Custom themes contain styling information only, not content

        Args:
            client_id: Client identifier

        Returns:
            List of custom themes with styling properties
        """
        try:
            if client_id in self.client_preferences:
                return self.client_preferences[client_id].get("custom_themes", [])
            return []
        except Exception as e:
            logger.error(f"Error getting custom themes for client {client_id}: {e}")
            return []

    async def update_theme_preferences(
        self,
        client_id: str,
        preferences: Dict[str, Any]
    ) -> bool:
        """
        Update theme preferences for a client
        Preferences contain styling choices only, not content

        Args:
            client_id: Client identifier
            preferences: Theme styling preferences

        Returns:
            True if preferences were updated successfully
        """
        try:
            if client_id not in self.client_preferences:
                self.client_preferences[client_id] = {}

            # Update styling preferences
            self.client_preferences[client_id].update({
                "font_size_preference": preferences.get("font_size", "medium"),
                "color_intensity": preferences.get("color_intensity", "medium"),
                "layout_complexity": preferences.get("layout_complexity", "medium"),
                "updated_at": datetime.now().isoformat()
            })

            logger.info(f"Updated theme preferences for client {client_id}")
            return True

        except Exception as e:
            logger.error(f"Error updating theme preferences for client {client_id}: {e}")
            return False

    async def get_theme_preferences(self, client_id: str) -> Dict[str, Any]:
        """
        Get theme preferences for a client
        Preferences contain styling choices only, not content

        Args:
            client_id: Client identifier

        Returns:
            Theme styling preferences
        """
        try:
            return self.client_preferences.get(client_id, {})
        except Exception as e:
            logger.error(f"Error getting theme preferences for client {client_id}: {e}")
            return {}

    def get_theme_styles_for_html(self, theme_id: str) -> Dict[str, str]:
        """
        Get CSS styles for a specific theme
        Returns styling information only, not content

        Args:
            theme_id: Theme identifier

        Returns:
            CSS styling properties
        """
        try:
            theme = self.available_themes.get(theme_id.lower())
            if not theme:
                theme = self.available_themes["default"]

            color_palette = theme.get("color_palette", [])
            if not color_palette:
                color_palette = ["#667eea", "#764ba2", "#f093fb"]

            primary_color = color_palette[0]
            secondary_color = color_palette[1] if len(color_palette) > 1 else primary_color
            accent_color = color_palette[2] if len(color_palette) > 2 else secondary_color

            return {
                'background': f'background: linear-gradient(135deg, {primary_color} 0%, {secondary_color} 100%);',
                'text_color': 'white',
                'overlay': f'background: linear-gradient(45deg, {accent_color} 0%, transparent 100%);',
                'content_bg': 'rgba(255,255,255,0.15)',
                'title_style': f'color: {primary_color};',
                'font_family': theme.get('font_family', 'Arial, sans-serif'),
                'layout_style': theme.get('layout_style', 'structured')
            }

        except Exception as e:
            logger.error(f"Error getting theme styles for {theme_id}: {e}")
            # Return default styles
            return {
                'background': 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);',
                'text_color': 'white',
                'overlay': 'background: linear-gradient(45deg, #f093fb 0%, transparent 100%);',
                'content_bg': 'rgba(255,255,255,0.15)',
                'title_style': 'color: #667eea;',
                'font_family': 'Arial, sans-serif',
                'layout_style': 'structured'
            }

    def get_theme_colors(self, theme_id: str) -> List[str]:
        """
        Get color palette for a specific theme
        Colors are used for styling only, not content generation

        Args:
            theme_id: Theme identifier

        Returns:
            List of hex color codes
        """
        try:
            theme = self.available_themes.get(theme_id.lower())
            if theme:
                return theme.get("color_palette", [])
            return ["#667eea", "#764ba2", "#f093fb"]  # Default colors
        except Exception as e:
            logger.error(f"Error getting theme colors for {theme_id}: {e}")
            return ["#667eea", "#764ba2", "#f093fb"]  # Default colors

    def _validate_theme_data(self, theme_data: Dict[str, Any]) -> bool:
        """
        Validate theme data structure
        Ensures theme contains styling information only, not content

        Args:
            theme_data: Theme data to validate

        Returns:
            True if theme data is valid
        """
        try:
            # Check required fields
            required_fields = ["theme_id", "theme_name"]
            for field in required_fields:
                if not theme_data.get(field):
                    logger.error(f"Missing required theme field: {field}")
                    return False

            # Check color palette
            color_palette = theme_data.get("color_palette", [])
            if not isinstance(color_palette, list) or len(color_palette) == 0:
                logger.error("Theme must have a valid color palette")
                return False

            # Validate color format (basic hex check)
            for color in color_palette:
                if not isinstance(color, str) or not color.startswith("#") or len(color) != 7:
                    logger.error(f"Invalid color format: {color}")
                    return False

            return True

        except Exception as e:
            logger.error(f"Error validating theme data: {e}")
            return False

    def _validate_custom_theme_data(self, theme_data: Dict[str, Any]) -> bool:
        """
        Validate custom theme data structure
        Ensures custom theme contains styling information only, not content

        Args:
            theme_data: Custom theme data to validate

        Returns:
            True if custom theme data is valid
        """
        try:
            # Check required fields for custom themes
            required_fields = ["theme_name", "color_palette"]
            for field in required_fields:
                if not theme_data.get(field):
                    logger.error(f"Missing required custom theme field: {field}")
                    return False

            # Validate color palette
            color_palette = theme_data.get("color_palette", [])
            if not isinstance(color_palette, list) or len(color_palette) < 3:
                logger.error("Custom theme must have at least 3 colors")
                return False

            # Validate color format
            for color in color_palette:
                if not isinstance(color, str) or not color.startswith("#") or len(color) != 7:
                    logger.error(f"Invalid color format in custom theme: {color}")
                    return False

            return True

        except Exception as e:
            logger.error(f"Error validating custom theme data: {e}")
            return False

    async def clear_client_themes(self, client_id: str) -> bool:
        """
        Clear all theme data for a client
        Removes styling preferences, not content

        Args:
            client_id: Client identifier

        Returns:
            True if themes were cleared successfully
        """
        try:
            if client_id in self.client_themes:
                del self.client_themes[client_id]
            
            if client_id in self.client_preferences:
                del self.client_preferences[client_id]
            
            logger.info(f"Cleared all theme data for client {client_id}")
            return True

        except Exception as e:
            logger.error(f"Error clearing theme data for client {client_id}: {e}")
            return False

    def get_service_stats(self) -> Dict[str, Any]:
        """
        Get theme service statistics
        Contains styling-related metrics only, not content

        Returns:
            Service statistics
        """
        try:
            return {
                "available_themes": len(self.available_themes),
                "clients_with_themes": len(self.client_themes),
                "clients_with_preferences": len(self.client_preferences),
                "total_custom_themes": sum(
                    len(prefs.get("custom_themes", [])) 
                    for prefs in self.client_preferences.values()
                )
            }
        except Exception as e:
            logger.error(f"Error getting theme service stats: {e}")
            return {"error": str(e)}
