"""
Theme Service for theme management and preferences
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
import json

logger = logging.getLogger(__name__)

class ThemeService:
    """Service for managing themes and user preferences"""
    
    def __init__(self):
        # Predefined themes with their properties
        self.available_themes = {
            "professional": {
                "theme_id": "professional",
                "theme_name": "Professional",
                "theme_description": "Clean, corporate design suitable for business presentations",
                "color_palette": ["#2E86AB", "#A23B72", "#F18F01", "#C73E1D", "#FFFFFF"],
                "preview_text": "Professional and polished",
                "font_family": "Arial, sans-serif",
                "layout_style": "structured",
                "accent_colors": ["#2E86AB", "#A23B72"]
            },
            "modern": {
                "theme_id": "modern",
                "theme_name": "Modern",
                "theme_description": "Contemporary design with bold colors and clean lines",
                "color_palette": ["#6366F1", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981"],
                "preview_text": "Bold and contemporary",
                "font_family": "Inter, sans-serif",
                "layout_style": "minimalist",
                "accent_colors": ["#6366F1", "#EC4899"]
            },
            "creative": {
                "theme_id": "creative",
                "theme_name": "Creative",
                "theme_description": "Artistic and expressive design for creative presentations",
                "color_palette": ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7"],
                "preview_text": "Artistic and vibrant",
                "font_family": "Poppins, sans-serif",
                "layout_style": "dynamic",
                "accent_colors": ["#FF6B6B", "#4ECDC4"]
            },
            "minimal": {
                "theme_id": "minimal",
                "theme_name": "Minimal",
                "theme_description": "Simple, clean design focusing on content",
                "color_palette": ["#000000", "#FFFFFF", "#F3F4F6", "#6B7280", "#374151"],
                "preview_text": "Simple and clean",
                "font_family": "Helvetica, sans-serif",
                "layout_style": "minimalist",
                "accent_colors": ["#000000", "#6B7280"]
            },
            "elegant": {
                "theme_id": "elegant",
                "theme_name": "Elegant",
                "theme_description": "Sophisticated design with refined aesthetics",
                "color_palette": ["#8B4513", "#D2691E", "#DEB887", "#F5DEB3", "#FFFFFF"],
                "preview_text": "Sophisticated and refined",
                "font_family": "Georgia, serif",
                "layout_style": "classic",
                "accent_colors": ["#8B4513", "#D2691E"]
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
        Store theme selection and preferences for a client
        
        Args:
            client_id: Client identifier
            theme_data: Theme selection data
            
        Returns:
            True if theme was stored successfully
        """
        try:
            # Validate theme data
            if not self._validate_theme_data(theme_data):
                logger.error(f"Invalid theme data for client {client_id}")
                return False
            
            # Store theme selection
            self.client_themes[client_id] = {
                "theme_id": theme_data.get("theme_id"),
                "theme_name": theme_data.get("theme_name"),
                "theme_description": theme_data.get("theme_description"),
                "color_palette": theme_data.get("color_palette", []),
                "preview_text": theme_data.get("preview_text", ""),
                "selected_at": datetime.now().isoformat(),
                "client_id": client_id
            }
            
            # Update client preferences
            if client_id not in self.client_preferences:
                self.client_preferences[client_id] = {}
            
            self.client_preferences[client_id]["current_theme"] = theme_data.get("theme_id")
            self.client_preferences[client_id]["theme_history"] = self.client_preferences[client_id].get("theme_history", [])
            self.client_preferences[client_id]["theme_history"].append({
                "theme_id": theme_data.get("theme_id"),
                "selected_at": datetime.now().isoformat()
            })
            
            logger.info(f"Theme selection stored for client {client_id}: {theme_data.get('theme_id')}")
            return True
            
        except Exception as e:
            logger.error(f"Error storing theme selection for client {client_id}: {e}")
            return False
    
    async def get_theme_selection(
        self,
        client_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get stored theme selection for a client
        
        Args:
            client_id: Client identifier
            
        Returns:
            Theme selection data or None if not found
        """
        return self.client_themes.get(client_id)
    
    async def get_theme_info(
        self,
        theme_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get theme information by theme ID
        
        Args:
            theme_id: Theme identifier
            
        Returns:
            Theme information or None if not found
        """
        return self.available_themes.get(theme_id)
    
    async def get_all_themes(self) -> List[Dict[str, Any]]:
        """
        Get all available themes
        
        Returns:
            List of all available themes
        """
        return list(self.available_themes.values())
    
    async def get_theme_preview(
        self,
        theme_id: str,
        sample_content: str = "Sample Content"
    ) -> Optional[Dict[str, Any]]:
        """
        Get theme preview with sample content
        
        Args:
            theme_id: Theme identifier
            sample_content: Sample content to display in preview
            
        Returns:
            Theme preview data or None if theme not found
        """
        theme_info = self.available_themes.get(theme_id)
        if not theme_info:
            return None
        
        # Generate preview HTML (simplified)
        preview_html = self._generate_theme_preview_html(theme_info, sample_content)
        
        return {
            "theme_id": theme_id,
            "preview_html": preview_html,
            "color_palette": theme_info["color_palette"],
            "font_family": theme_info["font_family"],
            "layout_style": theme_info["layout_style"]
        }
    
    async def customize_theme(
        self,
        client_id: str,
        base_theme_id: str,
        customizations: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Create a customized version of a theme
        
        Args:
            client_id: Client identifier
            base_theme_id: Base theme to customize
            customizations: Customization options
            
        Returns:
            Customized theme data or None if failed
        """
        try:
            base_theme = self.available_themes.get(base_theme_id)
            if not base_theme:
                logger.error(f"Base theme {base_theme_id} not found")
                return None
            
            # Create customized theme
            custom_theme = base_theme.copy()
            custom_theme["theme_id"] = f"custom_{client_id}_{int(datetime.now().timestamp())}"
            custom_theme["theme_name"] = f"Custom {base_theme['theme_name']}"
            custom_theme["is_custom"] = True
            custom_theme["base_theme_id"] = base_theme_id
            custom_theme["customized_at"] = datetime.now().isoformat()
            
            # Apply customizations
            if "color_palette" in customizations:
                custom_theme["color_palette"] = customizations["color_palette"]
            
            if "font_family" in customizations:
                custom_theme["font_family"] = customizations["font_family"]
            
            # Store custom theme
            self.client_themes[f"{client_id}_custom"] = custom_theme
            
            logger.info(f"Custom theme created for client {client_id}: {custom_theme['theme_id']}")
            return custom_theme
            
        except Exception as e:
            logger.error(f"Error creating custom theme for client {client_id}: {e}")
            return None
    
    async def get_client_theme_history(
        self,
        client_id: str
    ) -> List[Dict[str, Any]]:
        """
        Get theme selection history for a client
        
        Args:
            client_id: Client identifier
            
        Returns:
            List of theme selections with timestamps
        """
        preferences = self.client_preferences.get(client_id, {})
        return preferences.get("theme_history", [])
    
    async def get_theme_statistics(self) -> Dict[str, Any]:
        """
        Get theme usage statistics
        
        Returns:
            Dictionary containing theme usage statistics
        """
        try:
            theme_counts = {}
            total_selections = 0
            
            # Count theme selections
            for client_id, theme_data in self.client_themes.items():
                theme_id = theme_data.get("theme_id")
                if theme_id:
                    theme_counts[theme_id] = theme_counts.get(theme_id, 0) + 1
                    total_selections += 1
            
            # Get most popular themes
            popular_themes = sorted(
                theme_counts.items(),
                key=lambda x: x[1],
                reverse=True
            )[:5]
            
            return {
                "total_selections": total_selections,
                "unique_clients": len(self.client_themes),
                "theme_counts": theme_counts,
                "popular_themes": popular_themes,
                "available_themes_count": len(self.available_themes)
            }
            
        except Exception as e:
            logger.error(f"Error getting theme statistics: {e}")
            return {}
    
    def _validate_theme_data(self, theme_data: Dict[str, Any]) -> bool:
        """
        Validate theme data structure
        
        Args:
            theme_data: Theme data to validate
            
        Returns:
            True if valid, False otherwise
        """
        required_fields = ["theme_id", "theme_name", "color_palette"]
        
        for field in required_fields:
            if field not in theme_data:
                logger.error(f"Missing required field: {field}")
                return False
        
        # Validate color palette
        color_palette = theme_data.get("color_palette", [])
        if not isinstance(color_palette, list) or len(color_palette) == 0:
            logger.error("Color palette must be a non-empty list")
            return False
        
        # Validate color format (basic hex validation)
        for color in color_palette:
            if not isinstance(color, str) or not color.startswith("#"):
                logger.error(f"Invalid color format: {color}")
                return False
        
        return True
    
    def _generate_theme_preview_html(
        self,
        theme_info: Dict[str, Any],
        sample_content: str
    ) -> str:
        """
        Generate HTML preview for a theme
        
        Args:
            theme_info: Theme information
            sample_content: Sample content to display
            
        Returns:
            HTML preview string
        """
        try:
            primary_color = theme_info["color_palette"][0] if theme_info["color_palette"] else "#000000"
            secondary_color = theme_info["color_palette"][1] if len(theme_info["color_palette"]) > 1 else "#666666"
            
            html = f"""
            <div style="
                width: 300px;
                height: 200px;
                background: linear-gradient(135deg, {primary_color}, {secondary_color});
                border-radius: 12px;
                padding: 20px;
                color: white;
                font-family: {theme_info.get('font_family', 'Arial, sans-serif')};
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            ">
                <h3 style="margin: 0 0 10px 0; font-size: 18px;">{theme_info['theme_name']}</h3>
                <p style="margin: 0; font-size: 14px; opacity: 0.9;">{sample_content}</p>
                <div style="
                    margin-top: 15px;
                    display: flex;
                    gap: 8px;
                ">
            """
            
            # Add color palette preview
            for color in theme_info["color_palette"][:3]:  # Show first 3 colors
                html += f"""
                    <div style="
                        width: 20px;
                        height: 20px;
                        background-color: {color};
                        border-radius: 50%;
                        border: 2px solid white;
                    "></div>
                """
            
            html += """
                </div>
            </div>
            """
            
            return html
            
        except Exception as e:
            logger.error(f"Error generating theme preview HTML: {e}")
            return f"<div>Theme Preview: {theme_info.get('theme_name', 'Unknown')}</div>"
    
    def get_service_status(self) -> Dict[str, Any]:
        """Get overall service status"""
        return {
            "available_themes_count": len(self.available_themes),
            "client_themes_count": len(self.client_themes),
            "service_status": "operational"
        }
