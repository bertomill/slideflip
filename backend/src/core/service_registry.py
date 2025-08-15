"""
Service Registry

Centralized service management to prevent multiple initializations
and ensure singleton patterns for expensive services.
"""

import logging
from typing import Dict, Any, Optional, Type, TypeVar
from threading import Lock

logger = logging.getLogger(__name__)

T = TypeVar('T')

class ServiceRegistry:
    """
    Singleton service registry to manage service instances
    and prevent multiple initializations
    """
    
    _instance: Optional['ServiceRegistry'] = None
    _lock = Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
            
        self._services: Dict[str, Any] = {}
        self._service_factories: Dict[str, callable] = {}
        self._initialized = True
        logger.info("ServiceRegistry initialized")
    
    def register_service(self, service_name: str, service_instance: Any) -> None:
        """Register a service instance"""
        if service_name in self._services:
            logger.warning(f"Service {service_name} already registered, overwriting")
        
        self._services[service_name] = service_instance
        logger.debug(f"Service {service_name} registered")
    
    def register_factory(self, service_name: str, factory_func: callable) -> None:
        """Register a service factory function"""
        self._service_factories[service_name] = factory_func
        logger.debug(f"Service factory {service_name} registered")
    
    def get_service(self, service_name: str) -> Optional[Any]:
        """Get a registered service instance"""
        return self._services.get(service_name)
    
    def get_or_create_service(self, service_name: str, service_class: Type[T], *args, **kwargs) -> T:
        """
        Get an existing service or create a new one if it doesn't exist
        
        Args:
            service_name: Name of the service
            service_class: Class to instantiate if service doesn't exist
            *args, **kwargs: Arguments to pass to the service constructor
            
        Returns:
            Service instance
        """
        if service_name in self._services:
            logger.debug(f"Returning existing service: {service_name}")
            return self._services[service_name]
        
        # Check if we have a factory
        if service_name in self._service_factories:
            logger.debug(f"Creating service using factory: {service_name}")
            service_instance = self._service_factories[service_name](*args, **kwargs)
        else:
            logger.debug(f"Creating new service instance: {service_name}")
            service_instance = service_class(*args, **kwargs)
        
        self._services[service_name] = service_instance
        return service_instance
    
    def has_service(self, service_name: str) -> bool:
        """Check if a service is registered"""
        return service_name in self._services
    
    def list_services(self) -> list:
        """List all registered service names"""
        return list(self._services.keys())
    
    def clear_services(self) -> None:
        """Clear all registered services (useful for testing)"""
        self._services.clear()
        logger.info("All services cleared from registry")

# Global service registry instance
_service_registry: Optional[ServiceRegistry] = None

def get_service_registry() -> ServiceRegistry:
    """Get the global service registry instance"""
    global _service_registry
    if _service_registry is None:
        _service_registry = ServiceRegistry()
    return _service_registry

def register_service(service_name: str, service_instance: Any) -> None:
    """Register a service in the global registry"""
    get_service_registry().register_service(service_name, service_instance)

def get_service(service_name: str) -> Optional[Any]:
    """Get a service from the global registry"""
    return get_service_registry().get_service(service_name)

def get_or_create_service(service_name: str, service_class: Type[T], *args, **kwargs) -> T:
    """Get or create a service in the global registry"""
    return get_service_registry().get_or_create_service(service_name, service_class, *args, **kwargs)

def has_service(service_name: str) -> bool:
    """Check if a service exists in the global registry"""
    return get_service_registry().has_service(service_name)
